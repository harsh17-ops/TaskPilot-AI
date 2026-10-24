import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getVapi,
  isVapiConfigured,
  startVapiCall,
  stopVapiCall,
} from '../services/vapiClient.js';
import api from '../api/client.js';

/**
 * useVapi Hook
 * 
 * Provides complete call-state management, volume tracking, transcript processing,
 * and automated client-side tool execution for Vapi voice AI sessions.
 */
export function useVapi({ onFinalMessage, onToolExecuted } = {}) {
  const [callState, setCallState] = useState('idle'); // idle | connecting | listening | user-speaking | thinking | assistant-speaking | error | ended
  const [userVolume, setUserVolume] = useState(0);
  const [assistantVolume, setAssistantVolume] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveRole, setLiveRole] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const isCallActive = callState !== 'idle' && callState !== 'ended' && callState !== 'error';
  const callbacksRef = useRef({ onFinalMessage, onToolExecuted });

  useEffect(() => {
    callbacksRef.current = { onFinalMessage, onToolExecuted };
  }, [onFinalMessage, onToolExecuted]);

  // Dedup set for finalized message IDs
  const seenMessageIds = useRef(new Set());

  const start = useCallback(async ({ language = 'en', context = {}, assistantId = '' } = {}) => {
    setErrorMessage('');
    setLiveTranscript('');
    setLiveRole(null);
    setCallState('connecting');

    try {
      if (!isVapiConfigured()) {
        throw new Error(
          'Vapi is not configured. Add VITE_VAPI_PUBLIC_KEY in client/.env to enable live voice calls.'
        );
      }

      await startVapiCall({ language, context, assistantId });
    } catch (err) {
      console.error('Failed to start Vapi voice session:', err);
      const msg = err.message || 'Could not start voice session. Check microphone permissions and configuration.';
      setErrorMessage(msg);
      setCallState('error');
    }
  }, []);

  const stop = useCallback(() => {
    stopVapiCall();
    setCallState('idle');
    setUserVolume(0);
    setAssistantVolume(0);
    setLiveTranscript('');
    setLiveRole(null);
  }, []);

  useEffect(() => {
    const vapi = getVapi();
    if (!vapi) return;

    function handleCallStart() {
      setCallState('listening');
      setErrorMessage('');
    }

    function handleCallEnd() {
      setCallState('ended');
      setUserVolume(0);
      setAssistantVolume(0);
      setLiveTranscript('');
      setLiveRole(null);

      // Reset to idle after brief delay
      setTimeout(() => {
        setCallState((current) => (current === 'ended' ? 'idle' : current));
      }, 1500);
    }

    function handleSpeechStart() {
      setCallState((current) => {
        if (current === 'listening' || current === 'thinking') {
          return 'user-speaking';
        }
        return current;
      });
    }

    function handleSpeechEnd() {
      setCallState((current) => {
        if (current === 'user-speaking') {
          return 'thinking';
        }
        return current;
      });
    }

    function handleVolumeLevel(volume) {
      setAssistantVolume(volume);
      if (volume > 0.04) {
        setCallState('assistant-speaking');
      } else {
        setCallState((current) => (current === 'assistant-speaking' ? 'listening' : current));
      }
    }

    function handleLocalVolumeLevel(volume) {
      setUserVolume(volume);
      if (volume > 0.05) {
        setCallState('user-speaking');
      }
    }

    async function handleMessage(msg) {
      if (!msg) return;

      // 1. Handle live and finalized transcripts
      if (msg.type === 'transcript') {
        const role = msg.role || 'user';
        const text = msg.transcript || '';
        const isFinal = msg.transcriptType === 'final';

        if (!isFinal) {
          // Display interim speech without saving to database yet
          setLiveTranscript(text);
          setLiveRole(role);
          if (role === 'user') {
            setCallState('user-speaking');
          }
        } else if (text.trim()) {
          // Clear live preview and commit finalized message
          setLiveTranscript('');
          setLiveRole(null);

          const dedupeKey = `${role}-${text.trim()}`;
          if (!seenMessageIds.current.has(dedupeKey)) {
            seenMessageIds.current.add(dedupeKey);
            callbacksRef.current.onFinalMessage?.({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              role,
              content: text.trim(),
              mode: 'voice',
              timestamp: new Date(),
            });
          }

          if (role === 'user') {
            setCallState('thinking');
          } else {
            setCallState('listening');
          }
        }
      }

      // 2. Handle speech-update
      if (msg.type === 'speech-update') {
        if (msg.status === 'started') {
          if (msg.role === 'assistant') {
            setCallState('assistant-speaking');
          } else if (msg.role === 'user') {
            setCallState('user-speaking');
          }
        } else if (msg.status === 'stopped') {
          setCallState('listening');
        }
      }

      // 3. Handle model-output (assistant text stream)
      if (msg.type === 'model-output' && msg.output) {
        setCallState('assistant-speaking');
      }

      // 4. Handle client-side tool calls from Vapi
      if (
        msg.type === 'tool-calls' ||
        msg.type === 'function-call' ||
        msg.type === 'tool-call'
      ) {
        setCallState('thinking');
        const toolCalls =
          msg.toolCalls ||
          msg.toolCallList ||
          (msg.toolCall ? [msg.toolCall] : null) ||
          (msg.functionCall ? [msg.functionCall] : []);

        for (const call of toolCalls) {
          const toolName = call.name || call.function?.name;
          const toolCallId = call.id || call.toolCallId || `call_${Date.now()}`;
          let args = call.parameters || call.arguments || call.function?.arguments || {};
          if (typeof args === 'string') {
            try {
              args = JSON.parse(args);
            } catch {
              args = {};
            }
          }

          try {
            console.log(`[TaskPilot Voice Tool] Executing "${toolName}" with parameters:`, args);
            // Execute tool securely against user's authenticated session
            const res = await api.post('/agent/tools/execute', { toolName, args });
            const resultData = res.data?.result || {};
            console.log(`[TaskPilot Voice Tool] Result for "${toolName}":`, resultData);

            // Send tool result back to Vapi Web SDK using the official add-message format
            try {
              vapi.send({
                type: 'add-message',
                message: {
                  role: 'tool',
                  tool_call_id: toolCallId,
                  content: JSON.stringify(resultData),
                },
                triggerResponseEnabled: true,
              });
            } catch (sendErr) {
              console.warn('[Vapi] Failed to send add-message over WebRTC:', sendErr);
            }

            callbacksRef.current.onToolExecuted?.({
              toolName,
              toolCallId,
              args,
              result: resultData,
            });
          } catch (err) {
            console.error(`Tool execution error for "${toolName}":`, err);
            try {
              vapi.send({
                type: 'add-message',
                message: {
                  role: 'tool',
                  tool_call_id: toolCallId,
                  content: JSON.stringify({ error: err.response?.data?.error || err.message }),
                },
                triggerResponseEnabled: true,
              });
            } catch (sendErr) {
              console.warn('[Vapi] Failed to send tool error over WebRTC:', sendErr);
            }
          }
        }
      }
    }

    function handleError(err) {
      console.error('Vapi SDK event error:', err);
      const msg = err?.error?.message || err?.message || 'Voice connection encountered an error.';
      setErrorMessage(msg);
      setCallState('error');
    }

    // Attach Vapi event listeners
    vapi.on('call-start', handleCallStart);
    vapi.on('call-end', handleCallEnd);
    vapi.on('speech-start', handleSpeechStart);
    vapi.on('speech-end', handleSpeechEnd);
    vapi.on('volume-level', handleVolumeLevel);
    vapi.on('local-volume-level', handleLocalVolumeLevel);
    vapi.on('message', handleMessage);
    vapi.on('error', handleError);

    return () => {
      // Cleanup listeners on unmount
      vapi.off('call-start', handleCallStart);
      vapi.off('call-end', handleCallEnd);
      vapi.off('speech-start', handleSpeechStart);
      vapi.off('speech-end', handleSpeechEnd);
      vapi.off('volume-level', handleVolumeLevel);
      vapi.off('local-volume-level', handleLocalVolumeLevel);
      vapi.off('message', handleMessage);
      vapi.off('error', handleError);
    };
  }, []);

  return {
    callState,
    isCallActive,
    isConfigured: isVapiConfigured(),
    userVolume,
    assistantVolume,
    liveTranscript,
    liveRole,
    errorMessage,
    start,
    stop,
    clearError: () => setErrorMessage(''),
  };
}

export default useVapi;
