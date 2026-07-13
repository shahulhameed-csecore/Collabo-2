'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { extractFromFile, createCampaign, getApiErrorMessage } from '@/lib/api';
import type { CampaignFormState, ExtractedData } from '@/lib/types';
import { PLATFORMS } from '@/lib/types';
import {
  X, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  CloudUpload, ArrowRight, ArrowLeft, ImageIcon, Calendar,
  DollarSign, AtSign, User, Tag, FileText, Info, Zap,
  Rocket, File as FileIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Field, inputCls, AiThinkingAnimation } from '@/components/CampaignFormUtils';
import Image from 'next/image';

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
  destination_url: '',
  status: 'draft',
};

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 'upload', label: 'Upload', desc: 'Screenshot or manual' },
  { id: 'review', label: 'Review', desc: 'Confirm details' },
] as const;

// ── Main Component ────────────────────────────────────────────────────────────
export default function CreateCampaignModal({ isOpen, onClose, onSuccess }: CreateCampaignModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
  const [isDragOver, setIsDragOver] = useState(false);
  const [markActive, setMarkActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (filePreview && filePreview !== 'doc') URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    if (filePreview && filePreview !== 'doc') URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setExtracting(false);
    setExtractedData(null);
    setForm(EMPTY_FORM);
    setIsDragOver(false);
    setMarkActive(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const pickFile = (f: File) => {
    const isImage = f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.heic');
    const isDoc = f.type === 'application/pdf' || f.type.includes('wordprocessingml') || f.type === 'application/msword' || f.type.startsWith('text/') || f.name.endsWith('.pdf') || f.name.endsWith('.docx') || f.name.endsWith('.txt');
    
    if (!isImage && !isDoc) {
      toast.error('Unsupported format. Please upload an Image, PDF, DOCX, or TXT file.');
      return;
    }
    
    const maxDocSize = 10 * 1024 * 1024;
    const maxImageSize = 10 * 1024 * 1024;
    
    if (isImage && f.size > maxImageSize) {
      toast.error('Image too large. Maximum size is 10 MB.');
      return;
    }
    if (!isDoc && !isImage && f.size > maxDocSize) {
      toast.error('Document too large. Maximum size is 10 MB.');
      return;
    }
    
    if (filePreview && filePreview !== 'doc') URL.revokeObjectURL(filePreview);
    setFile(f);
    
    if (isImage) {
      setFilePreview(URL.createObjectURL(f));
    } else {
      setFilePreview('doc'); 
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
    e.target.value = '';
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    try {
      const data = await extractFromFile(file);
      setExtractedData(data);
      setForm({
        influencer_name:   data.influencer_name   ?? '',
        influencer_handle: data.influencer_handle ?? '',
        platform:          data.platform          ?? '',
        deliverables:      data.deliverables      ?? '',
        deadline:          (data.deadline && /^\d{4}-\d{2}-\d{2}$/.test(data.deadline)) ? data.deadline : '',
        payment_amount:    String(data.payment_amount ?? 0),
        special_notes:     data.special_notes     ?? '',
        destination_url:   '',
        status:            'draft',
      });
      setStep('review');
      if (data.requires_human_review) {
        toast.warning('Extraction needs review.', { icon: '⚠️' });
      } else {
        toast.success('AI extraction complete!', { icon: '✨' });
      }
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'AI extraction failed. You can enter details manually.');
      toast.error(msg);
      setExtractedData({
        influencer_name: null, influencer_handle: null, platform: null,
        deliverables: null, deadline: null, payment_amount: 0,
        special_notes: msg, destination_url: '', status: 'draft', requires_human_review: true,
      });
      setStep('review');
    } finally {
      setExtracting(false);
    }
  };

  const handleSkipToManual = () => {
    setExtractedData(null);
    setStep('review');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.influencer_handle.trim()) {
      toast.error('Influencer handle (@username) is required.');
      return;
    }
    if (!form.platform) {
      toast.error('Please select a platform.');
      return;
    }
    if (!form.deadline) {
      toast.error('Please select a deadline.');
      return;
    }
    if (!form.deliverables.trim()) {
      toast.error('Please enter the deliverables.');
      return;
    }
    setStep('submitting');
    try {
      await createCampaign({
        influencer_name:   form.influencer_name   || null,
        influencer_handle: form.influencer_handle.trim(),
        platform:          form.platform          || null,
        deliverables:      form.deliverables      || null,
        deadline:          form.deadline          || null,
        payment_amount:    parseFloat(form.payment_amount) || 0,
        special_notes:     form.special_notes     || null,
        destination_url:   form.destination_url   || null,
        status:            markActive ? 'active' : form.status,
      });
      toast.success('🎉 Campaign created successfully!');
      onSuccess();
      handleClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to create campaign. Please try again.'));
      setStep('review');
    }
  };

  const fieldChange = (field: keyof CampaignFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  if (!isOpen) return null;

  const needsReview = extractedData?.requires_human_review ?? false;
  const missingFields = needsReview
    ? [
        !form.influencer_handle && 'Handle',
        !form.deliverables      && 'Deliverables',
        !form.deadline          && 'Deadline',
      ].filter(Boolean) as string[]
    : [];

  const currentStepIdx = step === 'upload' ? 0 : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={step === 'submitting' ? undefined : handleClose}
      />

      <div className="relative w-full sm:max-w-2xl bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[95vh] animate-scale-in">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500/15 to-teal-500/10 rounded-xl border border-emerald-500/20">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base leading-tight">
                {step === 'upload' ? 'New Campaign' : step === 'submitting' ? 'Creating Campaign...' : 'Review & Confirm'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 'upload'
                  ? 'Upload a screenshot or fill manually'
                  : step === 'submitting'
                  ? 'Saving to your dashboard...'
                  : 'Verify details before saving'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-8">
            {STEPS.map((s, i) => {
              const isDone = currentStepIdx > i;
              const isCurrent = currentStepIdx === i || (step === 'submitting' && i === 1);
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={`
                    flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                    transition-all duration-300
                    ${isCurrent
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-600 border border-slate-700'}
                  `}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-8 h-px transition-colors duration-300 ${isDone ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleClose}
            disabled={step === 'submitting'}
            className="absolute right-4 top-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: UPLOAD ───────────────────────────────────── */}
          {step === 'upload' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-emerald-500/8 to-teal-500/5 border border-emerald-500/15 rounded-xl">
                <div className="p-2 bg-emerald-500/12 rounded-lg flex-shrink-0 border border-emerald-500/20">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">AI-powered extraction</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Upload an Image, PDF, or Text file and AI will auto-fill{' '}
                    <span className="text-emerald-400 font-medium">influencer details, deliverables, deadline & payment</span>.
                  </p>
                </div>
              </div>

              {extracting ? (
                <AiThinkingAnimation />
              ) : (
                <>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => !file && fileRef.current?.click()}
                    className={`
                      relative border-2 border-dashed rounded-2xl transition-all cursor-pointer overflow-hidden
                      ${isDragOver
                        ? 'border-emerald-400 bg-emerald-500/8 scale-[1.005]'
                        : file
                        ? 'border-emerald-500/40 bg-emerald-500/5 cursor-default'
                        : 'border-slate-700/50 hover:border-emerald-500/40 hover:bg-emerald-500/3'}
                    `}
                  >
                    {file ? (
                      <div className="relative p-6">
                        {filePreview === 'doc' ? (
                          <div className="flex flex-col items-center justify-center p-8 bg-slate-800/60 rounded-xl border border-slate-700">
                            <FileIcon className="w-16 h-16 text-emerald-400 mb-3" />
                            <p className="text-white font-bold text-center truncate w-full max-w-xs">{file.name}</p>
                            <p className="text-slate-400 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        ) : (
                          <Image
                            src={filePreview!}
                            alt="Uploaded preview"
                            width={800}
                            height={600}
                            className="w-full max-h-60 object-contain rounded-xl p-3"
                            unoptimized
                          />
                        )}
                        <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                            className="bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl px-4 py-2 backdrop-blur-sm border border-white/15 transition-all"
                          >
                            Change file
                          </button>
                        </div>
                        <div className="absolute top-4 right-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-lg z-10">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-14 px-6">
                        <div className={`p-5 rounded-2xl mb-4 transition-all ${isDragOver ? 'bg-emerald-500/20 scale-110' : 'bg-slate-800/60'}`}>
                          <CloudUpload className={`w-9 h-9 transition-colors ${isDragOver ? 'text-emerald-400' : 'text-slate-500'}`} />
                        </div>
                        <p className="text-white font-bold text-base mb-1">Drop your file or screenshot here</p>
                        <p className="text-slate-500 text-sm mb-4">or click to browse files</p>
                        <p className="text-xs text-slate-600">PDF, DOCX, TXT, PNG, JPG, HEIC · Max 10 MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*,.heic" className="hidden" onChange={handleFileChange} />

                  {file && (
                    <div className="flex items-center gap-2 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                      <ImageIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-slate-300 truncate flex-1">{file.name}</span>
                      <span className="text-xs text-slate-500 flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                      <button
                        onClick={() => { setFile(null); if (filePreview && filePreview !== 'doc') URL.revokeObjectURL(filePreview); setFilePreview(null); }}
                        className="text-slate-600 hover:text-rose-400 transition-colors p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleExtract}
                      disabled={!file}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
                    >
                      <Sparkles className="w-4 h-4" />
                      Extract with AI
                    </button>
                    <button
                      onClick={handleSkipToManual}
                      className="sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl px-5 py-3 text-sm transition-all border border-slate-700/50 hover:border-slate-600"
                    >
                      Enter manually
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP 2: REVIEW FORM ──────────────────────────────── */}
          {(step === 'review' || step === 'submitting') && (
            <form id="campaign-form" onSubmit={handleSubmit} className="p-5 space-y-4">
              {needsReview && (
                <div className="flex gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-400 mb-0.5">Please review carefully</p>
                    <p className="text-xs text-amber-400/70 leading-relaxed">
                      {extractedData?.special_notes && extractedData.special_notes.includes("Extract") 
                        ? extractedData.special_notes 
                        : missingFields.length > 0
                        ? `Couldn't extract: ${missingFields.join(', ')}. Please fill these in.`
                        : 'Please verify the details below.'}
                    </p>
                  </div>
                </div>
              )}

              {extractedData && !needsReview && (
                <div className="flex gap-3 p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-400 mb-0.5">AI extracted everything!</p>
                    <p className="text-xs text-emerald-400/70">Review the filled details and save when ready.</p>
                  </div>
                </div>
              )}

              {!extractedData && (
                <div className="flex gap-3 p-4 bg-slate-800/40 border border-slate-700/40 rounded-xl">
                  <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-400">Enter the campaign details manually below.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Influencer Name"
                  icon={User}
                  highlight={needsReview && !form.influencer_name}
                >
                  <input
                    type="text"
                    value={form.influencer_name}
                    onChange={e => fieldChange('influencer_name', e.target.value)}
                    placeholder="Riya Sharma"
                    className={inputCls(needsReview && !form.influencer_name)}
                  />
                </Field>

                <Field
                  label="Handle"
                  icon={AtSign}
                  required
                  highlight={needsReview && !form.influencer_handle}
                >
                  <input
                    type="text"
                    required
                    value={form.influencer_handle}
                    onChange={e => fieldChange('influencer_handle', e.target.value)}
                    placeholder="@riya_creates"
                    className={inputCls(needsReview && !form.influencer_handle)}
                  />
                </Field>

                <Field label="Platform" icon={Tag}>
                  <select
                    value={form.platform}
                    onChange={e => fieldChange('platform', e.target.value)}
                    className={inputCls()}
                  >
                    <option value="">Select platform</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>

                <Field label="Deadline" icon={Calendar} highlight={needsReview && !form.deadline}>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => fieldChange('deadline', e.target.value)}
                    className={inputCls(needsReview && !form.deadline)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </Field>

                <Field label="Payment (₹ INR)" icon={DollarSign}>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.payment_amount}
                      onChange={e => fieldChange('payment_amount', e.target.value)}
                      placeholder="0 for gifted deal"
                      className={`${inputCls()} pl-8`}
                    />
                  </div>
                  {form.payment_amount === '0' && (
                    <p className="text-xs text-emerald-400/70 mt-1 ml-1">₹0 = Gifted Deal 🎁</p>
                  )}
                </Field>

                <Field label="Initial Status" icon={Info}>
                  <select
                    value={form.status}
                    onChange={e => fieldChange('status', e.target.value as CampaignFormState['status'])}
                    className={inputCls()}
                    disabled={markActive}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
              </div>

              <Field label="Deliverables" icon={FileText} highlight={needsReview && !form.deliverables}>
                <textarea
                  rows={2}
                  value={form.deliverables}
                  onChange={e => fieldChange('deliverables', e.target.value)}
                  placeholder="1 Reel (30s) + 2 Story frames with swipe-up link"
                  className={inputCls(needsReview && !form.deliverables)}
                />
              </Field>

              <Field label="Special Notes / Instructions" icon={FileText}>
                <textarea
                  rows={2}
                  value={form.special_notes}
                  onChange={e => fieldChange('special_notes', e.target.value)}
                  placeholder="Moodboard link, brand colours, dos & don'ts..."
                  className={inputCls()}
                />
              </Field>

              <Field label="Destination URL (for Tracking Link)" icon={Rocket}>
                <input
                  type="url"
                  value={form.destination_url}
                  onChange={e => fieldChange('destination_url', e.target.value)}
                  placeholder="https://mybrand.com/summer-sale"
                  className={inputCls()}
                />
              </Field>
            </form>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        {(step === 'review' || step === 'submitting') && (
          <div className="border-t border-slate-800/60 bg-slate-900/95 px-5 py-4 flex-shrink-0">
            <div className={`flex items-center justify-between mb-4 p-3.5 rounded-xl border transition-all duration-200 ${
              markActive
                ? 'bg-emerald-500/8 border-emerald-500/20'
                : 'bg-slate-800/40 border-slate-700/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-all ${markActive ? 'bg-emerald-500/15 border border-emerald-500/20' : 'bg-slate-700/40'}`}>
                  <Rocket className={`w-3.5 h-3.5 transition-colors ${markActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Launch immediately</p>
                  <p className="text-xs text-slate-500">Save as <span className={markActive ? 'text-emerald-400 font-medium' : ''}>Active</span> instead of Draft</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMarkActive(v => !v)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full border transition-all duration-300 ${
                  markActive
                    ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/25'
                    : 'bg-slate-700 border-slate-600'
                }`}
                aria-label="Toggle launch immediately"
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${markActive ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={step === 'submitting'}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-semibold transition-colors disabled:opacity-40 px-2 py-1.5 rounded-lg hover:bg-slate-800"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="submit"
                form="campaign-form"
                disabled={step === 'submitting'}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl px-6 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25"
              >
                {step === 'submitting' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving campaign...</>
                ) : (
                  <>
                    {markActive ? <Rocket className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    {markActive ? 'Launch Campaign' : 'Save Campaign'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
