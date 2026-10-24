import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Mic,
  ArrowUpRight,
  Globe,
  Plus,
  History,
  CheckCircle,
  Volume2,
} from 'lucide-react';
import api from '../api/client.js';
import Heading from '../components/common/Heading.jsx';
import VoiceVisualizer from '../components/voice/VoiceVisualizer.jsx';
import ConversationHistory from '../components/voice/ConversationHistory.jsx';
import { useVapi } from '../hooks/useVapi.js';

/**
 * Multilingual AI Assistant Page
 * 
 * Unifies conversational text chat and real-time Vapi voice AI:
 * - Live voice interaction with real SDK call states and audio waveforms
 * - English, Kannada (ಕನ್ನಡ), and Hindi (हिंदी) language support
 * - Real-time speech transcription & duplicate-protected message rendering
 * - Secure MongoDB conversation persistence and history management
 * - Authenticated productivity tools for schedule, tasks, routines, and streaks
 */
export function Assistant({ refresh }) {
  // Multilingual configuration
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // Conversation persistence state
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Text input and loading states
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Workspace context for tool execution and voice initialization
  const [workspaceContext, setWorkspaceContext] = useState(null);

  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load workspace context (user info, streaks, session token)
  useEffect(() => {
    api
      .get('/agent/context')
      .then((res) => setWorkspaceContext(res.data))
      .catch((err) => console.warn('Could not load agent context:', err));
  }, []);

  // Load saved conversations on mount
  const loadConversations = async () => {
    try {
      const res = await api.get('/conversations');
      const list = res.data.conversations || [];
      setConversations(list);

      // Auto-open most recent conversation if none is active
      if (!activeConversationId && list.length > 0) {
        openConversation(list[0].id);
      } else if (!activeConversationId && list.length === 0) {
        startNewConversation();
      }
    } catch (err) {
      console.warn('Could not load conversation history:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Open an existing conversation
  const openConversation = async (convId) => {
    try {
      const res = await api.get(`/conversations/${convId}`);
      const conv = res.data.conversation;
      setActiveConversationId(conv._id);
      setSelectedLanguage(conv.language || 'en');
      setMessages(conv.messages || []);
      setError('');
    } catch (err) {
      setError('Could not load conversation.');
    }
  };

  // Start a fresh conversation
  const startNewConversation = async () => {
    try {
      const initialAssistantGreeting =
        selectedLanguage === 'kn'
          ? 'ನಮಸ್ಕಾರ! ನಾನು ಟಾಸ್ಕ್‌ಪೈಲಟ್ AI ಅಸಿಸ್ಟೆಂಟ್. ನಾನು ನಿಮ್ಮ ಕೆಲಸ ಮತ್ತು ದಿನಚರಿಯನ್ನು ಯೋಜಿಸಲು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?'
          : selectedLanguage === 'hi'
          ? 'नमस्ते! मैं टास्कपायलट AI असिस्टेंट हूँ। मैं आपके काम और रूटीन को प्लान करने में कैसे मदद करूँ?'
          : 'Hi! I can check your schedule, create or find tasks, and help you stay on top of your daily routines. What would you like to work on?';

      const res = await api.post('/conversations', {
        title: 'New Conversation',
        language: selectedLanguage,
        mode: 'mixed',
        initialMessage: {
          role: 'assistant',
          content: initialAssistantGreeting,
          mode: 'text',
        },
      });

      const newConv = res.data.conversation;
      setActiveConversationId(newConv._id);
      setMessages(newConv.messages || []);
      setConversations((prev) => [
        {
          id: newConv._id,
          title: newConv.title,
          language: newConv.language,
          mode: newConv.mode,
          lastActivityAt: newConv.lastActivityAt,
        },
        ...prev.filter((c) => c.id !== newConv._id),
      ]);
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
  };

  // Delete a saved conversation
  const handleDeleteConversation = async (convId) => {
    try {
      await api.delete(`/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        startNewConversation();
      }
    } catch (err) {
      setError('Could not delete conversation.');
    }
  };

  // Persist a finalized message incrementally to MongoDB
  const persistMessage = async (msg) => {
    if (!activeConversationId) return;
    try {
      await api.post(`/conversations/${activeConversationId}/messages`, {
        messages: [msg],
      });
      // Refresh conversation list titles in background
      api.get('/conversations').then((res) => setConversations(res.data.conversations || []));
    } catch (err) {
      console.warn('Failed to persist message to database:', err);
    }
  };

  // Callback when Vapi emits a finalized speech message
  const handleFinalVoiceMessage = (msg) => {
    setMessages((prev) => {
      // Deduplicate identical message contents
      if (prev.some((m) => m.id === msg.id || (m.content === msg.content && m.role === msg.role))) {
        return prev;
      }
      return [...prev, msg];
    });

    persistMessage(msg);
    refresh?.();
  };

  // Callback when a voice tool was executed
  const handleVoiceToolExecuted = ({ toolName, result }) => {
    if (result?.message) {
      const toolMsg = {
        id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: `⚡ ${result.message}`,
        mode: 'voice',
        language: selectedLanguage,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, toolMsg]);
      persistMessage(toolMsg);
    }
    // Dispatch global event so workspace views (Overview, Tasks, Today) reload immediately
    window.dispatchEvent(new CustomEvent('task-updated'));
    refresh?.();
  };

  // Vapi Voice hook
  const {
    callState,
    isCallActive,
    isConfigured: isVapiConfigured,
    userVolume,
    assistantVolume,
    liveTranscript,
    errorMessage: voiceError,
    start: startVoiceCall,
    stop: stopVoiceCall,
    clearError: clearVoiceError,
  } = useVapi({
    onFinalMessage: handleFinalVoiceMessage,
    onToolExecuted: handleVoiceToolExecuted,
  });

  // Start voice session
  const handleStartVoice = () => {
    startVoiceCall({
      language: selectedLanguage,
      context: workspaceContext || {},
    });
  };

  // Send a text message (works whether voice is active or inactive)
  const handleSendText = async (textToSend = input) => {
    const trimmed = textToSend.trim();
    if (!trimmed || busy) return;

    const userMsg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: trimmed,
      mode: 'text',
      language: selectedLanguage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);
    setError('');

    // Persist user message to active conversation
    persistMessage(userMsg);

    try {
      const response = await api.post('/agent/command', { message: trimmed });
      const { message, result } = response.data;

      let formattedResultText = '';
      if (result) {
        if (Array.isArray(result)) {
          formattedResultText = `\n\n${result
            .map((t) => `• ${t.title} (${t.status})`)
            .join('\n')}`;
        } else if (result.title) {
          formattedResultText = `\n\nCreated: ${result.title}`;
        }
      }

      const assistantMsg = {
        id: `${Date.now() + 1}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: message + formattedResultText,
        mode: 'text',
        language: selectedLanguage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      persistMessage(assistantMsg);
      refresh?.();
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || 'Could not reach the assistant. Please try again.';
      setError(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: errorMsg,
          mode: 'text',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Language-specific prompt suggestions
  const promptSuggestions = {
    en: [
      'Tell me my schedule for today',
      'What tasks do I need to complete today?',
      'Which tasks are overdue?',
      'What is my routine completion status?',
      'Summarize my productivity this week',
      'Create a task to prepare the demo for tomorrow',
    ],
    kn: [
      'ಇವತ್ತು ನಾನು ಯಾವ ಕೆಲಸಗಳನ್ನು ಮುಗಿಸಬೇಕು?',
      'ನನ್ನ ದಿನಚರಿ ಹೇಗಿದೆ?',
      'ಮುಂದಿನ ಕೆಲಸಗಳನ್ನು ತೋರಿಸಿ',
      'ಇವತ್ತಿನ ಶೆಡ್ಯೂಲ್ ತಿಳಿಸಿ',
      'ನಾಳೆಗೆ ಹೊಸ ಕೆಲಸ ಸೇರಿಸಿ',
    ],
    hi: [
      'आज मुझे कौन-कौन से काम पूरे करने हैं?',
      'मेरी रूटीन का क्या स्टेटस है?',
      'मेरे पेंडिंग टास्क दिखाओ',
      'आज का शेड्यूल बताओ',
      'कल के लिए एक टास्क बनाओ',
    ],
  };

  const currentPrompts = promptSuggestions[selectedLanguage] || promptSuggestions.en;

  return (
    <>
      <Heading
        eyebrow="YOUR MULTILINGUAL VOICE & TEXT AI"
        title="AI Assistant"
        sub="Talk naturally in English, Kannada, or Hindi to manage tasks, schedules, and daily routines."
        action={
          <div className="assistant-top-controls">
            {/* Language Selector */}
            <div className="lang-selector-wrap">
              <Globe size={15} />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="lang-select"
                title="Select preferred language"
              >
                <option value="en">English</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="hi">हिंदी (Hindi)</option>
              </select>
            </div>

            {/* Conversation History Toggle */}
            <button
              type="button"
              className={`secondary-btn history-toggle-btn ${historyOpen ? 'active' : ''}`}
              onClick={() => setHistoryOpen(!historyOpen)}
              title="Toggle saved conversations"
            >
              <History size={15} />
              <span>History</span>
              <span className="count-pill">{conversations.length}</span>
            </button>

            {/* New Conversation Button */}
            <button
              type="button"
              className="secondary-btn new-chat-top-btn"
              onClick={startNewConversation}
              title="Start a new conversation"
            >
              <Plus size={15} /> New chat
            </button>
          </div>
        }
      />

      {/* Main Interactive Grid */}
      <div className={`assistant-layout ${historyOpen ? 'history-expanded' : ''}`}>
        {/* Main Conversation & Voice Panel */}
        <div className="panel chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="assistant-avatar">
              <Sparkles size={18} />
            </div>
            <div>
              <b>TaskPilot Voice & Chat Assistant</b>
              <small>
                <i /> Ready · {selectedLanguage === 'kn' ? 'ಕನ್ನಡ' : selectedLanguage === 'hi' ? 'हिंदी' : 'English'}
              </small>
            </div>
            <span className="privacy-chip">🔒 Scoped to your account</span>
          </div>

          {/* Real-time Voice Interaction Card */}
          <VoiceVisualizer
            callState={callState}
            isCallActive={isCallActive}
            userVolume={userVolume}
            assistantVolume={assistantVolume}
            liveTranscript={liveTranscript}
            errorMessage={voiceError}
            onStart={handleStartVoice}
            onStop={stopVoiceCall}
            onClearError={clearVoiceError}
            isConfigured={isVapiConfigured}
            selectedLanguage={selectedLanguage}
          />

          {/* Scrollable Conversation History */}
          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id || m.timestamp} className={`chat-message ${m.role}`}>
                <div className="message-avatar">
                  {m.role === 'assistant' ? '✦' : 'Y'}
                </div>
                <div className="message-bubble-wrap">
                  <div className="message-bubble">
                    {m.content}
                    {m.mode === 'voice' && (
                      <span className="voice-tag" title="Spoken via voice">
                        <Volume2 size={11} /> voice
                      </span>
                    )}
                  </div>
                  {m.timestamp && (
                    <span className="message-time">
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Live Streaming Indicator */}
            {busy && (
              <div className="chat-message assistant">
                <div className="message-avatar">✦</div>
                <div className="message-bubble typing">
                  Thinking<span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {error && <div className="chat-error">{error}</div>}

          {/* Bottom Chat & Voice Input */}
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendText();
            }}
          >
            <button
              type="button"
              className={`icon-btn mic-btn ${isCallActive ? 'active-pulse' : ''}`}
              title={isCallActive ? 'End voice call' : 'Start voice call'}
              onClick={isCallActive ? stopVoiceCall : handleStartVoice}
            >
              <Mic size={17} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedLanguage === 'kn'
                  ? 'ಟಾಸ್ಕ್ ಅಥವಾ ವೇಳಾಪಟ್ಟಿಯ ಬಗ್ಗೆ ಕೇಳಿ…'
                  : selectedLanguage === 'hi'
                  ? 'टास्क या शेड्यूल के बारे में पूछें…'
                  : 'Ask to schedule a task, check routines, or plan your day…'
              }
            />
            <button
              type="submit"
              className="send-btn"
              disabled={!input.trim() || busy}
            >
              <ArrowUpRight size={17} />
            </button>
          </form>

          <div className="chat-disclaimer">
            Voice & text AI actions are verified directly against your TaskPilot workspace data.
          </div>
        </div>

        {/* Sidebar: Suggestions or Conversation History */}
        <div className="assistant-aside">
          {historyOpen ? (
            <ConversationHistory
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={(id) => {
                openConversation(id);
                setHistoryOpen(false);
              }}
              onNewConversation={startNewConversation}
              onDeleteConversation={handleDeleteConversation}
            />
          ) : (
            <>
              {/* Quick Prompt Suggestions */}
              <div className="panel suggestion-panel">
                <div className="eyebrow">
                  {selectedLanguage === 'kn'
                    ? 'ಪ್ರಶ್ನೆಗಳು'
                    : selectedLanguage === 'hi'
                    ? 'सुझाव'
                    : 'TRY ASKING'}
                </div>
                {currentPrompts.map((promptText) => (
                  <button
                    type="button"
                    key={promptText}
                    onClick={() => handleSendText(promptText)}
                  >
                    <span>{promptText}</span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>

              {/* Multilingual Voice Note */}
              <div className="ai-note">
                <Sparkles size={16} />
                <p>
                  <b>Multilingual Voice AI</b>
                  <br />
                  Speak naturally in English, Kannada, or Hindi. The assistant accesses real workspace deadlines and routine streaks.
                </p>
              </div>

              {/* Secure Tools Note */}
              <div className="panel tools-pill-panel">
                <div className="eyebrow">CONNECTED TOOLS</div>
                <div className="tool-chips">
                  <span><CheckCircle size={11} /> Today Schedule</span>
                  <span><CheckCircle size={11} /> Task CRUD</span>
                  <span><CheckCircle size={11} /> Routine Streaks</span>
                  <span><CheckCircle size={11} /> Week Summary</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Assistant;
