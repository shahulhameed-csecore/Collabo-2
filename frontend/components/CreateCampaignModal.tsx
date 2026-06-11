'use client';

import { useState, useRef, useCallback } from 'react';
import { extractFromImage, createCampaign } from '@/lib/api';
import type { CampaignFormState, ExtractedData } from '@/lib/types';
import {
  X, Upload, Sparkles, Loader2, AlertTriangle,
  CheckCircle2, CloudUpload, ArrowRight, ArrowLeft,
  ImageIcon, Calendar, DollarSign, AtSign, User, Tag, FileText, Info
} from 'lucide-react';
import { toast } from 'sonner';

type Step = 'upload' | 'review' | 'submitting';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_FORM: CampaignFormState = {
  influencer_name: '',
  influencer_handle: '',
  platform: '',
  deliverables: '',
  deadline: '',
  payment_amount: '0',
  special_notes: '',
  status: 'draft',
};

const PLATFORMS = ['Instagram', 'YouTube', 'Twitter/X', 'LinkedIn', 'TikTok', 'Other'];

export default function CreateCampaignModal({ isOpen, onClose, onSuccess }: CreateCampaignModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setFilePreview(null);
    setExtracting(false);
    setExtractedData(null);
    setForm(EMPTY_FORM);
    setIsDragOver(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('image/')) {
      pickFile(dropped);
    } else {
      toast.error('Please upload an image file (PNG, JPG, etc.)');
    }
  }, []);

  const pickFile = (f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    try {
      const data = await extractFromImage(file);
      setExtractedData(data);
      setForm({
        influencer_name: data.influencer_name ?? '',
        influencer_handle: data.influencer_handle ?? '',
        platform: data.platform ?? '',
        deliverables: data.deliverables ?? '',
        deadline: data.deadline ?? '',
        payment_amount: String(data.payment_amount ?? 0),
        special_notes: data.special_notes ?? '',
        status: 'draft',
      });
      setStep('review');
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } }).response?.status;
      if (status === 429) {
        toast.error('Rate limit hit. Please wait 1 minute before trying again.');
      } else {
        toast.error('AI extraction failed. You can enter details manually.');
        setExtractedData({ influencer_name: null, influencer_handle: null, platform: null, deliverables: null, deadline: null, payment_amount: 0, special_notes: null, status: 'draft', requires_human_review: true });
        setStep('review');
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleSkipToManual = () => {
    setExtractedData({ influencer_name: null, influencer_handle: null, platform: null, deliverables: null, deadline: null, payment_amount: 0, special_notes: null, status: 'draft', requires_human_review: true });
    setStep('review');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.influencer_handle.trim()) {
      toast.error('Influencer handle is required.');
      return;
    }
    setStep('submitting');
    try {
      await createCampaign({
        influencer_name: form.influencer_name || null,
        influencer_handle: form.influencer_handle,
        platform: form.platform || null,
        deliverables: form.deliverables || null,
        deadline: form.deadline || null,
        payment_amount: parseFloat(form.payment_amount) || 0,
        special_notes: form.special_notes || null,
        status: form.status,
      });
      toast.success('Campaign created successfully!');
      onSuccess();
      handleClose();
    } catch {
      toast.error('Failed to create campaign. Please try again.');
      setStep('review');
    }
  };

  const fieldChange = (field: keyof CampaignFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  const missingFields = extractedData?.requires_human_review
    ? [
        !form.influencer_name && 'Influencer Name',
        !form.influencer_handle && 'Influencer Handle',
        !form.deliverables && 'Deliverables',
        !form.deadline && 'Deadline',
      ].filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-2xl bg-slate-900 border border-slate-800/60 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">
                {step === 'upload' ? 'New Campaign' : step === 'submitting' ? 'Saving...' : 'Review & Confirm'}
              </h2>
              <p className="text-xs text-slate-500">
                {step === 'upload' ? 'Upload a screenshot for AI extraction' : 'Check all the details before saving'}
              </p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mr-8">
            {(['upload', 'review'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full transition-all ${step === s || (step === 'submitting' && s === 'review') ? 'bg-emerald-400 scale-110' : step === 'review' && s === 'upload' ? 'bg-emerald-600' : 'bg-slate-700'}`} />
                {i === 0 && <div className="w-6 h-px bg-slate-700" />}
              </div>
            ))}
          </div>
          <button onClick={handleClose} className="absolute right-4 top-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ─── STEP 1: UPLOAD ─────────────────────────────────────── */}
          {step === 'upload' && (
            <div className="p-6 space-y-5">
              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => !file && fileRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-2xl transition-all cursor-pointer
                  ${isDragOver ? 'border-emerald-400 bg-emerald-500/5 scale-[1.01]' : 'border-slate-700/60 hover:border-emerald-500/40 hover:bg-emerald-500/3'}
                  ${file ? 'border-emerald-500/40 bg-emerald-500/5 cursor-default' : ''}
                `}
              >
                {file && filePreview ? (
                  <div className="relative">
                    <img src={filePreview} alt="Uploaded screenshot" className="w-full max-h-64 object-contain rounded-xl p-2" />
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} className="bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg px-4 py-2 backdrop-blur-sm transition-all">
                        Change image
                      </button>
                    </div>
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 px-6">
                    <div className={`p-4 rounded-2xl mb-4 transition-all ${isDragOver ? 'bg-emerald-500/20' : 'bg-slate-800/60'}`}>
                      <CloudUpload className={`w-8 h-8 ${isDragOver ? 'text-emerald-400' : 'text-slate-500'}`} />
                    </div>
                    <p className="text-white font-medium mb-1">Drop your screenshot here</p>
                    <p className="text-slate-500 text-sm mb-4">or click to browse files</p>
                    <p className="text-xs text-slate-600">PNG, JPG, WEBP · Max 5MB</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              {file && (
                <div className="flex items-center gap-2 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                  <ImageIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-sm text-slate-300 truncate">{file.name}</span>
                  <span className="text-xs text-slate-500 flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleExtract}
                  disabled={!file || extracting}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-emerald-500/25"
                >
                  {extracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> AI is analyzing your screenshot...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Extract with AI</>
                  )}
                </button>
                <button
                  onClick={handleSkipToManual}
                  disabled={extracting}
                  className="sm:flex-shrink-0 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl px-5 py-3 text-sm transition-all border border-slate-700/50"
                >
                  Enter manually
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: REVIEW FORM ────────────────────────────────── */}
          {(step === 'review' || step === 'submitting') && (
            <form id="campaign-form" onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Human review warning banner */}
              {extractedData?.requires_human_review && (
                <div className="flex gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-400 mb-0.5">AI needs your help!</p>
                    <p className="text-xs text-amber-400/70">
                      {missingFields.length > 0
                        ? `Some fields couldn't be extracted: ${missingFields.join(', ')}. Please fill them in.`
                        : 'Please review all fields and confirm accuracy before saving.'}
                    </p>
                  </div>
                </div>
              )}

              {/* AI extraction success banner */}
              {extractedData && !extractedData.requires_human_review && (
                <div className="flex gap-3 p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-400">AI successfully extracted all fields! Review and save.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Influencer Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                    <User className="w-3.5 h-3.5" /> Influencer Name
                  </label>
                  <input
                    type="text"
                    value={form.influencer_name}
                    onChange={(e) => fieldChange('influencer_name', e.target.value)}
                    placeholder="Riya Sharma"
                    className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                {/* Influencer Handle */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                    <AtSign className="w-3.5 h-3.5" /> Handle <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.influencer_handle}
                    onChange={(e) => fieldChange('influencer_handle', e.target.value)}
                    placeholder="@riya_creates"
                    className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                {/* Platform */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                    <Tag className="w-3.5 h-3.5" /> Platform
                  </label>
                  <select
                    value={form.platform}
                    onChange={(e) => fieldChange('platform', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  >
                    <option value="">Select platform</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Deadline */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                    <Calendar className="w-3.5 h-3.5" /> Deadline
                  </label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => fieldChange('deadline', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                {/* Payment Amount */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                    <DollarSign className="w-3.5 h-3.5" /> Payment (₹ INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={form.payment_amount}
                    onChange={(e) => fieldChange('payment_amount', e.target.value)}
                    placeholder="0 for barter"
                    className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                    <Info className="w-3.5 h-3.5" /> Initial Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => fieldChange('status', e.target.value as CampaignFormState['status'])}
                    className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Deliverables */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                  <FileText className="w-3.5 h-3.5" /> Deliverables
                </label>
                <textarea
                  rows={2}
                  value={form.deliverables}
                  onChange={(e) => fieldChange('deliverables', e.target.value)}
                  placeholder="1 Reel (30s) + 2 Story Frames with swipe-up link"
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none"
                />
              </div>

              {/* Special Notes */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
                  <FileText className="w-3.5 h-3.5" /> Special Notes
                </label>
                <textarea
                  rows={2}
                  value={form.special_notes}
                  onChange={(e) => fieldChange('special_notes', e.target.value)}
                  placeholder="Any additional instructions, moodboard links, etc."
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {(step === 'review' || step === 'submitting') && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/60 bg-slate-900/80 flex-shrink-0">
            <button
              type="button"
              onClick={() => setStep('upload')}
              disabled={step === 'submitting'}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="submit"
              form="campaign-form"
              disabled={step === 'submitting'}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25"
            >
              {step === 'submitting' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving campaign...</>
              ) : (
                <>Save Campaign <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
