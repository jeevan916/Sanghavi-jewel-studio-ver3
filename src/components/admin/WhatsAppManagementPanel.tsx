import React, { useEffect, useState } from 'react';
import { storeService } from '@/services/storeService.ts';
import { 
  MessageCircle, RefreshCw, Send, Trash2, Plus, 
  CheckCircle2, AlertCircle, Loader2, Users, FileText, 
  Settings, Check, Smartphone, Sparkles, Megaphone, Search
} from 'lucide-react';

export function WhatsAppManagementPanel() {
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'send' | 'subscribers' | 'logs'>('templates');
  const [templates, setTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for template creation
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('UTILITY');
  const [tplBodyText, setTplBodyText] = useState('');
  const [tplButtons, setTplButtons] = useState<any[]>([]);

  // Form states for manual send
  const [sendPhone, setSendPhone] = useState('');
  const [sendName, setSendName] = useState('');
  const [sendType, setSendType] = useState<'text' | 'template'>('template');
  const [selectedTplId, setSelectedTplId] = useState('');
  const [customText, setCustomText] = useState('');
  const [variables, setVariables] = useState<string[]>(['']);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tpls, lgs, subs] = await Promise.all([
        storeService.getWhatsAppTemplates(),
        storeService.getWhatsAppLogs(),
        storeService.getWhatsAppSubscribers()
      ]);
      setTemplates(tpls);
      setLogs(lgs);
      setSubscribers(subs);
      if (tpls.length > 0 && !selectedTplId) {
        setSelectedTplId(tpls[0].id);
      }
    } catch (e) {
      console.error(e);
      showFeedback('error', 'Failed to retrieve WhatsApp dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // 1. Template Creation
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName || !tplBodyText) return;
    setActionLoading(true);
    try {
      await storeService.saveWhatsAppTemplate({
        name: tplName,
        category: tplCategory,
        body_text: tplBodyText,
        buttons: tplButtons
      });
      showFeedback('success', `Template '${tplName}' created as Draft. Please sync with Meta.`);
      setTplName('');
      setTplBodyText('');
      setTplButtons([]);
      setShowCreateTemplate(false);
      // reload
      const tpls = await storeService.getWhatsAppTemplates();
      setTemplates(tpls);
    } catch (e: any) {
      showFeedback('error', e.message || 'Failed to create template');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Sync Template
  const handleSyncTemplate = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await storeService.syncWhatsAppTemplate(id);
      showFeedback('success', res.message || 'Template synchronized successfully!');
      const tpls = await storeService.getWhatsAppTemplates();
      setTemplates(tpls);
      // Reload logs too
      const lgs = await storeService.getWhatsAppLogs();
      setLogs(lgs);
    } catch (e: any) {
      showFeedback('error', e.message || 'Sync failed');
    } finally {
      setActionLoading(false);
    }
  };

  // 2b. Check Template Status from Meta
  const handleCheckTemplateStatus = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await storeService.checkWhatsAppTemplateStatus(id);
      showFeedback('success', res.message || 'Template status checked successfully!');
      const tpls = await storeService.getWhatsAppTemplates();
      setTemplates(tpls);
      // Reload logs too
      const lgs = await storeService.getWhatsAppLogs();
      setLogs(lgs);
    } catch (e: any) {
      showFeedback('error', e.message || 'Status check failed');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Delete Template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    setActionLoading(true);
    try {
      await storeService.deleteWhatsAppTemplate(id);
      showFeedback('success', 'Template deleted successfully');
      setTemplates(templates.filter(t => t.id !== id));
    } catch (e: any) {
      showFeedback('error', e.message || 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Send Manual Message
  const handleSendManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendPhone) return;
    setActionLoading(true);
    try {
      const payload = {
        phone: sendPhone,
        name: sendName,
        type: sendType,
        templateId: selectedTplId,
        customText: customText,
        variables: sendType === 'template' ? variables : []
      };

      const res = await storeService.sendManualWhatsApp(payload);
      showFeedback('success', `Message successfully sent to ${sendPhone}!`);
      setSendPhone('');
      setSendName('');
      setCustomText('');
      setVariables(['']);
      
      // Reload metrics
      const [lgs, subs] = await Promise.all([
        storeService.getWhatsAppLogs(),
        storeService.getWhatsAppSubscribers()
      ]);
      setLogs(lgs);
      setSubscribers(subs);
    } catch (e: any) {
      showFeedback('error', e.message || 'Sending failed. Verify API config in settings.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Clear Logs
  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all WhatsApp logs?')) return;
    setActionLoading(true);
    try {
      await storeService.clearWhatsAppLogs();
      setLogs([]);
      showFeedback('success', 'Logs cleared successfully');
    } catch (e: any) {
      showFeedback('error', e.message || 'Failed to clear logs');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Trigger Gold Rate Broadcast manually
  const handleTriggerGoldRateBroadcast = async () => {
    if (!confirm(`Are you sure you want to trigger a daily Gold Rate alert to all ${subscribers.length} active subscribers?`)) return;
    setActionLoading(true);
    try {
      const res = await storeService.triggerWhatsAppGoldRateBroadcast();
      showFeedback('success', `Broadcast complete! Sent gold rate alerts to ${res.sentCount} of ${res.subscriberCount} opt-in subscribers.`);
      const [lgs, subs] = await Promise.all([
        storeService.getWhatsAppLogs(),
        storeService.getWhatsAppSubscribers()
      ]);
      setLogs(lgs);
      setSubscribers(subs);
    } catch (e: any) {
      showFeedback('error', e.message || 'Broadcast failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddVariable = () => {
    setVariables([...variables, '']);
  };

  const handleVariableChange = (idx: number, val: string) => {
    const updated = [...variables];
    updated[idx] = val;
    setVariables(updated);
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-stone-400 space-y-4 animate-pulse">
        <Loader2 className="animate-spin text-brand-gold" size={32} />
        <span className="text-xs uppercase tracking-widest font-bold">Synchronising Studio Channels...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Dynamic Notifications */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 text-white animate-slide-up ${feedback.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-xs font-bold tracking-wide uppercase">{feedback.message}</span>
        </div>
      )}

      {/* Hero Header & KPI Cards */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
            <MessageCircle size={32} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-2xl text-brand-dark tracking-tight">WhatsApp Studio</h3>
            <p className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.25em] mt-0.5">Automated Broadcasts & Client Outreach</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
          {/* Subscriber Counter */}
          <div className="bg-stone-50 px-5 py-3.5 rounded-2xl border border-stone-100 min-w-[120px]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1">
              <Users size={12} className="text-emerald-500" /> Subscribers
            </span>
            <p className="text-2xl font-bold font-mono text-brand-dark mt-1">{subscribers.length}</p>
          </div>

          {/* Logs Counter */}
          <div className="bg-stone-50 px-5 py-3.5 rounded-2xl border border-stone-100 min-w-[120px]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1">
              <FileText size={12} className="text-brand-gold" /> Sent Logs
            </span>
            <p className="text-2xl font-bold font-mono text-brand-dark mt-1">{logs.length}</p>
          </div>

          {/* Broadcast Trigger Button */}
          <button
            onClick={handleTriggerGoldRateBroadcast}
            disabled={actionLoading || subscribers.length === 0}
            className="flex-1 lg:flex-none px-6 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-100 disabled:text-stone-400 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Megaphone size={16} className="animate-bounce" />
                Trigger Gold Rate Alert
              </>
            )}
          </button>
        </div>
      </div>

      {/* Secondary Sub-Tabs Nav */}
      <div className="flex bg-stone-100 p-1.5 rounded-2xl items-center overflow-x-auto border border-stone-200/50">
        {[
          { id: 'templates', label: 'Outreach Templates', count: templates.length },
          { id: 'send', label: 'Broadcast Studio' },
          { id: 'subscribers', label: 'WhatsApp Subscribers', count: subscribers.length },
          { id: 'logs', label: 'Activity Logs', count: logs.length }
        ].map(subTab => (
          <button 
            key={subTab.id}
            onClick={() => setActiveSubTab(subTab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap uppercase tracking-[0.18em] ${activeSubTab === subTab.id ? 'bg-white shadow-md text-brand-dark' : 'text-stone-400 hover:text-brand-dark'}`}
          >
            {subTab.label}
            {subTab.count !== undefined && (
              <span className={`px-2 py-0.5 text-[8px] font-mono font-bold rounded-full ${activeSubTab === subTab.id ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-stone-200 text-stone-500'}`}>
                {subTab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* --- SUB-TAB: TEMPLATES --- */}
      {activeSubTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Campaign & Alert Templates</h4>
              <p className="text-xs font-serif italic text-stone-500 mt-1">Design, synchronized Meta status, and dynamic variable mapping.</p>
            </div>
            <button
              onClick={() => setShowCreateTemplate(!showCreateTemplate)}
              className="px-4 py-2 bg-brand-dark text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} /> Create Template
            </button>
          </div>

          {/* Template Creation Block */}
          {showCreateTemplate && (
            <form onSubmit={handleCreateTemplate} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-md space-y-4 animate-fade-in">
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-brand-dark pb-2 border-b border-stone-50">New WhatsApp Template Draft</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Template Unique Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. exclusive_festive_offer"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Category</label>
                  <select
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-200 bg-white rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                  >
                    <option value="UTILITY">Utility (Rates, Wishlist Drops, Subscriptions)</option>
                    <option value="MARKETING">Marketing (Offers, Catalog Highlights)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Message Body Template</label>
                  <span className="text-[8px] font-bold text-brand-gold uppercase tracking-widest">Use {"{{1}}"}, {"{{2}}"} etc. as dynamic placeholders</span>
                </div>
                <textarea
                  required
                  rows={4}
                  placeholder={`Hello {{1}},\n\nWe have a special design just for you. Today's Gold rate is ₹{{2}}/g.`}
                  value={tplBodyText}
                  onChange={(e) => setTplBodyText(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 font-sans leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplate(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-[9px] font-bold uppercase tracking-widest text-stone-500 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest"
                >
                  {actionLoading ? <Loader2 size={12} className="animate-spin" /> : 'Save Template Draft'}
                </button>
              </div>
            </form>
          )}

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-stone-50 border border-stone-100 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider text-stone-500">
                      {tpl.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border ${
                      (tpl.status === 'Approved' || tpl.status === 'APPROVED')
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : (tpl.status === 'Pending' || tpl.status === 'PENDING')
                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : (tpl.status === 'Rejected' || tpl.status === 'REJECTED' || tpl.status === 'REJECTED_LITE')
                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                        : 'bg-stone-50 text-stone-500 border-stone-100'
                    }`}>
                      {tpl.status || 'Draft'}
                    </span>
                  </div>
 
                  <h5 className="font-mono text-xs font-bold text-brand-dark mb-3 break-all">{tpl.name}</h5>
                  
                  <div className="bg-stone-50/50 p-4 rounded-xl border border-stone-100 min-h-[140px] flex flex-col justify-between mb-4">
                                        <p className="text-stone-600 text-[11px] leading-relaxed whitespace-pre-line font-sans italic">
                      {tpl.body_text}
                    </p>
                    
                    {Array.isArray(tpl.sample_variables) && tpl.sample_variables.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-1.5">
                        <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Sample Variables</span>
                        <div className="flex flex-wrap gap-1.5">
                          {tpl.sample_variables.map((v: any, vIdx: number) => (
                            <span key={vIdx} className="px-2 py-0.5 bg-stone-100 border border-stone-200 rounded text-[9px] font-mono text-stone-500">
                              {"{{"}{vIdx+1}{"}}"}: {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {Array.isArray(tpl.buttons) && tpl.buttons.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-1.5">
                        {tpl.buttons.map((b: any, bIdx: number) => (
                          <span key={bIdx} className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-[8px] font-bold uppercase tracking-widest text-stone-500">
                            Button: {b.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
 
                <div className="flex items-center gap-2 pt-2 border-t border-stone-50">
                  <button
                    onClick={() => handleSyncTemplate(tpl.id)}
                    disabled={actionLoading}
                    className="flex-1 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 border border-emerald-100 transition-colors"
                    title="Sync this template with Meta WhatsApp Cloud Platform"
                  >
                    <RefreshCw size={11} className={actionLoading ? 'animate-spin' : ''} /> Sync
                  </button>
                  <button
                    onClick={() => handleCheckTemplateStatus(tpl.id)}
                    disabled={actionLoading}
                    className="flex-1 py-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 border border-sky-100 transition-colors"
                    title="Check template approval status from Meta API"
                  >
                    <Search size={11} className={actionLoading ? 'animate-spin' : ''} /> Check Status
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    disabled={actionLoading}
                    className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="Delete template"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- SUB-TAB: BROADCAST STUDIO (SEND) --- */}
      {activeSubTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Send form */}
          <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm space-y-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Broadcast Composer</h4>
              <p className="text-xs font-serif italic text-stone-500 mt-1">Push alerts, catalogs, or custom reminders to any individual client.</p>
            </div>

            <form onSubmit={handleSendManual} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Recipient Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +919876543210"
                    value={sendPhone}
                    onChange={(e) => setSendPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Recipient Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Anand Sanghavi"
                    value={sendName}
                    onChange={(e) => setSendName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Outreach Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendType('template')}
                    className={`py-2 px-4 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all ${
                      sendType === 'template' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' 
                      : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    Use Template Model
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendType('text')}
                    className={`py-2 px-4 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all ${
                      sendType === 'text' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' 
                      : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    Custom Plain Text
                  </button>
                </div>
              </div>

              {sendType === 'template' && (
                <div className="space-y-4 pt-2 border-t border-stone-50">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Select Synced Template</label>
                    <select
                      value={selectedTplId}
                      onChange={(e) => setSelectedTplId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-stone-200 bg-white rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2"
                    >
                      {templates.filter(t => t.is_synced).map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                      ))}
                    </select>
                  </div>

                  {/* Variables listing */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Template Variable Map ({"{{1}}"}, {"{{2}}"}...)</label>
                      <button
                        type="button"
                        onClick={handleAddVariable}
                        className="text-[8px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-600"
                      >
                        + Add Variable
                      </button>
                    </div>

                    <div className="space-y-2">
                      {variables.map((val, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <span className="font-mono text-[9px] font-bold text-stone-400 min-w-[36px]">{"{{"}{idx + 1}{"}}"}</span>
                          <input
                            type="text"
                            required
                            placeholder={`Value for place holder {{${idx + 1}}}`}
                            value={val}
                            onChange={(e) => handleVariableChange(idx, e.target.value)}
                            className="flex-grow px-3 py-1.5 border border-stone-200 rounded-lg text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {sendType === 'text' && (
                <div className="space-y-1 pt-2 border-t border-stone-50">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Message Plain Text</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter message body here..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> Send Message Alert</>}
              </button>
            </form>
          </div>

          {/* Composer Preview Pane */}
          <div className="bg-stone-50 p-6 md:p-8 rounded-[2rem] border border-stone-100 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Live Device Mockup</h4>
              <p className="text-xs font-serif italic text-stone-500 mt-1">Real-time render of dynamic text variables matching Meta structures.</p>
              
              <div className="mt-8 max-w-[280px] mx-auto bg-[#efeae2] rounded-[2.5rem] p-3 shadow-2xl border-4 border-stone-200 relative aspect-[9/16] flex flex-col">
                {/* Speaker/Notch */}
                <div className="w-24 h-4 bg-stone-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <div className="w-12 h-1 bg-stone-300 rounded-full" />
                </div>

                <div className="flex-grow flex flex-col justify-end p-2 pb-6">
                  {/* WhatsApp Message bubble */}
                  <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-sm border border-stone-100/50 relative text-left">
                    <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <span>Sanghavi Studio</span>
                    </p>
                    
                    <p className="text-[10px] text-stone-800 leading-relaxed font-sans whitespace-pre-wrap">
                      {sendType === 'text' ? (customText || 'Message composer draft...') : (() => {
                        const t = templates.find(temp => temp.id === selectedTplId);
                        if (!t) return 'Choose a template to preview live variables...';
                        let text = t.body_text;
                        variables.forEach((v, idx) => {
                          text = text.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), v || `[Variable ${idx + 1}]`);
                        });
                        return text;
                      })()}
                    </p>
                    <span className="block text-right text-[7px] text-stone-400 mt-1 font-mono">12:00 PM</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest pt-4">
              Meta Cloud Sandbox Compliant
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: SUBSCRIBERS --- */}
      {activeSubTab === 'subscribers' && (
        <div className="bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400 font-sans">Active Subscribers</h4>
              <p className="text-xs font-serif italic text-stone-500 mt-1">Users subscribed to automated Gold Rate twice daily updates.</p>
            </div>
            
            <button
              onClick={handleTriggerGoldRateBroadcast}
              disabled={actionLoading || subscribers.length === 0}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 border border-emerald-200"
            >
              <Megaphone size={14} /> Send Broadcast to All
            </button>
          </div>

          {subscribers.length === 0 ? (
            <div className="py-20 text-center text-stone-400 font-serif italic">
              No registered WhatsApp Gold Rate subscribers found yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-100">
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400">Subscriber</th>
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400">WhatsApp Phone</th>
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400 font-sans">Opt-In Date</th>
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {subscribers.map((sub) => (
                    <tr key={sub.id} className="hover:bg-stone-50/20 transition-all font-sans text-xs">
                      <td className="px-6 py-4 font-bold text-brand-dark">
                        {sub.name || 'Valued Guest'}
                      </td>
                      <td className="px-6 py-4 font-mono text-stone-500">
                        {sub.phone}
                      </td>
                      <td className="px-6 py-4 text-stone-400 font-serif italic">
                        {new Date(sub.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSendPhone(sub.phone);
                            setSendName(sub.name || '');
                            setActiveSubTab('send');
                          }}
                          className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1 border border-emerald-100"
                        >
                          <Send size={10} /> Compose Custom
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- SUB-TAB: LOGS --- */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Activity & Transmission Logs</h4>
              <p className="text-xs font-serif italic text-stone-500 mt-1">Audit trail of automated notifications, sync jobs, and subscription updates.</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={fetchData}
                className="p-2 text-stone-400 hover:text-brand-dark hover:bg-stone-50 rounded-xl transition-colors border border-stone-200"
                title="Refresh logs"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={handleClearLogs}
                disabled={logs.length === 0}
                className="px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Clear Logs
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="py-20 text-center text-stone-400 font-serif italic">
              No WhatsApp audit logs available yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-100">
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400">Timestamp</th>
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400">Recipient</th>
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400 font-sans">Alert Type</th>
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400">Message Detail</th>
                    <th className="px-6 py-4 text-[9px] font-bold uppercase tracking-widest text-stone-400">Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-stone-50/20 transition-all text-[11px] font-sans">
                      <td className="px-6 py-4 text-stone-400 font-mono whitespace-nowrap">
                        {new Date(log.sentAt || log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-brand-dark block">{log.recipient_name}</span>
                        <span className="font-mono text-[9px] text-stone-400">{log.recipient_phone}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-stone-100 border border-stone-200/50 rounded text-[8px] font-mono font-bold uppercase text-stone-600">
                          {log.message_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-sm">
                        <p className="text-stone-700 truncate" title={log.message_body}>{log.message_body}</p>
                        {log.template_name && (
                          <span className="text-[8px] font-mono text-brand-gold font-bold">Template: {log.template_name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                          log.status === 'sent' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {log.status === 'sent' ? 'Delivered' : 'Failed'}
                        </span>
                        {log.errorMessage && (
                          <span className="block text-[8px] text-red-500 font-mono mt-1 break-all max-w-[140px] truncate" title={log.errorMessage}>
                            Error: {log.errorMessage}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
