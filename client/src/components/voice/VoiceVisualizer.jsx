import React from 'react';
import { Mic, PhoneOff, AlertCircle, Sparkles } from 'lucide-react';

/**
 * VoiceVisualizer Component
 * 
 * Renders real-time audio waveforms, call status indicators,
 * and microphone controls synchronized with the Vapi Web SDK.
 */
export function VoiceVisualizer({
  callState,
  isCallActive,
  userVolume = 0,
  assistantVolume = 0,
  liveTranscript = '',
  errorMessage = '',
  onStart,
  onStop,
  onClearError,
  isConfigured = true,
  selectedLanguage = 'en',
}) {
  // Compute waveform bar heights based on live volume levels (normalized 0 to 1)
  const activeVolume = callState === 'assistant-speaking' ? assistantVolume : userVolume;
  const clampedVol = Math.min(1, Math.max(0, activeVolume));

  const barHeights = [
    Math.max(6, Math.round(clampedVol * 28 + Math.sin(Date.now() / 200) * 4)),
    Math.max(8, Math.round(clampedVol * 42 + Math.cos(Date.now() / 180) * 6)),
    Math.max(12, Math.round(clampedVol * 55 + Math.sin(Date.now() / 150) * 8)),
    Math.max(8, Math.round(clampedVol * 38 + Math.cos(Date.now() / 220) * 5)),
    Math.max(6, Math.round(clampedVol * 24 + Math.sin(Date.now() / 250) * 3)),
  ];

  const getStatusLabel = () => {
    switch (callState) {
      case 'connecting':
        return 'Connecting to Voice AI…';
      case 'listening':
        return 'Listening… (speak naturally)';
      case 'user-speaking':
        return 'Listening to you…';
      case 'thinking':
        return 'Thinking…';
      case 'assistant-speaking':
        return 'Assistant is speaking…';
      case 'error':
        return 'Voice connection issue';
      case 'ended':
        return 'Call ended';
      default:
        return 'Ready to talk';
    }
  };

  return (
    <div className={`voice-interaction-card ${isCallActive ? 'call-active' : ''}`}>
      <div className="voice-card-main">
        {/* Animated Mic or Call Button */}
        <div className="voice-mic-container">
          {isCallActive ? (
            <button
              type="button"
              className={`voice-active-btn state-${callState}`}
              onClick={onStop}
              title="End voice conversation"
              aria-label="End voice conversation"
            >
              <PhoneOff size={20} />
            </button>
          ) : (
            <button
              type="button"
              className="voice-start-btn"
              onClick={onStart}
              title="Start voice conversation"
              aria-label="Start voice conversation"
            >
              <Mic size={22} />
            </button>
          )}

          {/* Pulse animation ring during active calls */}
          {isCallActive && <div className={`pulse-ring state-${callState}`} />}
        </div>

        {/* Status info & Live Waveform */}
        <div className="voice-info-col">
          <div className="voice-status-row">
            <span className={`status-dot state-${callState}`} />
            <strong className="voice-status-title">{getStatusLabel()}</strong>
            {selectedLanguage && (
              <span className="lang-badge">
                {selectedLanguage === 'kn'
                  ? 'ಕನ್ನಡ'
                  : selectedLanguage === 'hi'
                  ? 'हिंदी'
                  : 'English'}
              </span>
            )}
          </div>

          {/* Waveform Visualization when speaking */}
          {(callState === 'user-speaking' || callState === 'assistant-speaking') ? (
            <div className="waveform-container">
              {barHeights.map((h, i) => (
                <span
                  key={i}
                  className={`wave-bar ${callState === 'assistant-speaking' ? 'assistant' : 'user'}`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
          ) : (
            <p className="voice-hint">
              {isCallActive
                ? 'Speak in your chosen language or ask about tasks and routines.'
                : 'Click the microphone to start a live voice conversation.'}
            </p>
          )}
        </div>

        {/* Action Button */}
        <div className="voice-actions">
          {isCallActive ? (
            <button
              type="button"
              className="secondary-btn end-call-btn"
              onClick={onStop}
            >
              <PhoneOff size={15} /> End call
            </button>
          ) : (
            <button
              type="button"
              className="primary-btn start-call-btn"
              onClick={onStart}
            >
              <Mic size={15} /> Start Voice AI
            </button>
          )}
        </div>
      </div>

      {/* Live Transcript Banner when User is speaking */}
      {liveTranscript && (
        <div className="live-transcript-bubble">
          <span className="live-badge">Live Transcript</span>
          <p>“{liveTranscript}”</p>
        </div>
      )}

      {/* Error Alert if error occurred */}
      {errorMessage && (
        <div className="voice-error-banner">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
          <button type="button" onClick={onClearError}>
            Dismiss
          </button>
        </div>
      )}

      {/* Notice if Vapi key is not yet configured */}
      {!isConfigured && (
        <div className="vapi-config-notice">
          <Sparkles size={14} />
          <span>
            <b>Voice AI Configuration:</b> Add your <code>VITE_VAPI_PUBLIC_KEY</code> to{' '}
            <code>client/.env</code> to connect live Vapi voice streaming. Text chat and Web Speech remain available.
          </span>
        </div>
      )}
    </div>
  );
}

export default VoiceVisualizer;
