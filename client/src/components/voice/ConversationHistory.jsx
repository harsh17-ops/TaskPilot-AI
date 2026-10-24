import React from 'react';
import { Plus, MessageSquare, Trash2, Mic, FileText, ChevronRight } from 'lucide-react';

/**
 * ConversationHistory Component
 * Displays past chat and voice sessions stored in MongoDB,
 * allowing users to switch between conversations or start a new session.
 */
export function ConversationHistory({
  conversations = [],
  activeConversationId = null,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) {
  return (
    <div className="panel conversation-history-panel">
      <div className="history-head">
        <div>
          <h3>Conversation History</h3>
          <p>Saved voice & text sessions</p>
        </div>
        <button
          type="button"
          className="icon-btn new-chat-btn"
          title="Start new conversation"
          onClick={onNewConversation}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="history-empty">
            <MessageSquare size={20} />
            <p>No saved conversations yet.</p>
            <small>Your chat and voice transcripts will be saved here automatically.</small>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const formattedDate = conv.lastActivityAt
              ? new Date(conv.lastActivityAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : '';

            return (
              <div
                key={conv.id}
                className={`conversation-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className="conv-icon">
                  {conv.mode === 'voice' ? (
                    <Mic size={14} />
                  ) : (
                    <FileText size={14} />
                  )}
                </div>

                <div className="conv-details">
                  <b className="conv-title" title={conv.title}>
                    {conv.title || 'Untitled Session'}
                  </b>
                  <div className="conv-meta">
                    <span>{formattedDate}</span>
                    {conv.language && (
                      <span className="conv-lang">
                        {conv.language.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="icon-btn conv-delete-btn"
                  title="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this saved conversation?')) {
                      onDeleteConversation(conv.id);
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>

                <ChevronRight size={14} className="conv-arrow" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ConversationHistory;
