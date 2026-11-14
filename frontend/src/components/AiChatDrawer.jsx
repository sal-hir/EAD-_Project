import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Send, X, Package, Calculator, HelpCircle, ChevronDown, Wrench } from 'lucide-react';
import { publicServices } from '../api/publicServices';
import { Button } from './ui';

export function AiChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'model',
      text: "👋 Hello! I'm **SwiftDrop AI**, your real-time delivery and logistics assistant.\n\nAsk me anything about your shipments, rates, or delivery zones!",
      toolsInvoked: []
    }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || busy) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setBusy(true);

    try {
      // Build conversation history for API
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, text: m.text }));

      const response = await publicServices.aiChat(text, history);

      const botMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        text: response.reply,
        toolsInvoked: response.toolsInvoked || []
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'model',
          text: '⚠️ I had trouble connecting to the SwiftDrop network. Please check your connection and try again.',
          toolsInvoked: []
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const promptChips = [
    { label: 'Track SWIFT-1001-LK', icon: Package, query: 'Where is my parcel SWIFT-1001-LK?' },
    { label: 'Calculate fee to Kandy', icon: Calculator, query: 'How much to send 2.5 kg to Kandy?' },
    { label: 'Track SWIFT-1002-LK', icon: Package, query: 'Can you track SWIFT-1002-LK for me?' },
    { label: 'Delivery hours', icon: HelpCircle, query: 'What are your delivery hours and standard timings?' }
  ];

  // Simple Markdown text renderer for bold, lists, and code
  const renderFormattedText = (text) => {
    return text.split('\n').map((line, lineIdx) => {
      // Bullet list item
      if (line.trim().startsWith('- ')) {
        const content = line.trim().substring(2);
        return (
          <li key={lineIdx} className="ml-4 list-disc text-sm">
            {formatSpans(content)}
          </li>
        );
      }
      return (
        <p key={lineIdx} className={line.trim() === '' ? 'h-2' : 'mb-1 text-sm leading-relaxed'}>
          {formatSpans(line)}
        </p>
      );
    });
  };

  const formatSpans = (str) => {
    // Split by code, bold, etc.
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-blue-700 border border-blue-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <aside aria-label="SwiftDrop AI Delivery Assistant widget" className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="swift-ai-chat-drawer"
          className="group flex min-h-12 items-center gap-2.5 rounded-full bg-[#F95716] px-5 py-3 text-white shadow-2xl transition-all duration-200 hover:bg-[#E0480C] hover:scale-105 focus:outline-none focus:ring-4 focus:ring-orange-300"
        >
          {isOpen ? (
            <>
              <X size={20} className="text-white" />
              <span className="text-sm font-bold">Close Assistant</span>
            </>
          ) : (
            <>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-300 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              </span>
              <Bot size={20} className="text-white" />
              <span className="text-sm font-bold">Ask SwiftDrop AI</span>
              <Sparkles size={16} className="text-orange-200" />
            </>
          )}
        </button>
      </aside>

      {/* Slide-out Chat Drawer / Widget */}
      {isOpen && (
        <section
          id="swift-ai-chat-drawer"
          aria-label="SwiftDrop AI Delivery Assistant"
          className="fixed bottom-24 right-4 z-50 flex h-[540px] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6 sm:w-[420px]"
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-800 bg-[#0E131F] px-5 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F95716] text-white shadow-sm">
                <Bot size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">SwiftDrop AI Assistant</h3>
                  <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-300 border border-orange-400/30">
                    MCP Tools
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live Tracking & Dynamic Rates
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              aria-label="Minimize assistant"
            >
              <ChevronDown size={20} />
            </button>
          </header>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Tool Invocation Chip */}
                {msg.toolsInvoked && msg.toolsInvoked.length > 0 && (
                  <div className="mb-1 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-mono font-medium text-amber-800 shadow-xs">
                    <Wrench size={12} className="text-amber-600" />
                    <span>Called MCP Tool: <strong>{msg.toolsInvoked.join(', ')}</strong></span>
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs ${
                    msg.role === 'user'
                      ? 'rounded-tr-xs bg-blue-600 text-white'
                      : 'rounded-tl-xs border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {renderFormattedText(msg.text)}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-2 pl-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-bounce" />
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 font-medium">Checking live shipment database...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Suggestions */}
          <div className="border-t border-slate-100 bg-white px-3 py-2">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Suggested queries:
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {promptChips.map((chip, idx) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(chip.query)}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50/80 px-3 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-100 hover:text-orange-800 transition disabled:opacity-50"
                  >
                    <Icon size={12} />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask: 'Where is SWIFT-1001-LK?'"
              disabled={busy}
              className="ui-input flex-1 min-h-10 text-sm py-2 px-3 focus:ring-blue-500"
            />
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!input.trim() || busy}
              className="min-h-10 px-3.5"
            >
              <Send size={16} />
            </Button>
          </form>
        </section>
      )}
    </>
  );
}
