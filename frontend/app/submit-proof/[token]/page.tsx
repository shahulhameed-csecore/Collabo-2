'use client';

import { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

export default function SubmitProofPage() {
  const { token } = useParams() as { token: string };
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Invalid file type. Only JPG, PNG, MP4, and MOV are allowed.');
      return;
    }
    
    // Check sizes
    if (selectedFile.type.startsWith('image/') && selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Image size exceeds 10MB limit.');
      return;
    }
    if (selectedFile.type.startsWith('video/') && selectedFile.size > 50 * 1024 * 1024) {
      toast.error('Video size exceeds 50MB limit.');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/${token}/upload-proof`, {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        data = await res.json();
      } catch (_parseError) {
        throw new Error('Server returned an unexpected response. Please try again later.');
      }

      if (!res.ok) {
        throw new Error(data?.detail || 'Upload failed');
      }

      setSuccess(true);
      toast.success('Proof uploaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Proof Submitted!</h1>
        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
          Thank you. The brand has been notified and will review your content shortly. You can safely close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Upload Proof of Posting</h1>
        <p className="text-slate-400 text-sm text-center mb-8">
          Please upload your post screenshot or video to mark your deliverable as completed.
        </p>

        <div
          className={`relative w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700 bg-slate-800/50 hover:border-emerald-500/50 hover:bg-slate-800'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,video/mp4,video/quicktime"
            className="hidden"
          />
          <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-emerald-400' : 'text-slate-500'}`} />
          <h3 className="text-white font-semibold mb-1 text-center px-4">
            {file ? file.name : 'Click or drag file to upload'}
          </h3>
          <p className="text-slate-500 text-xs">
            JPG, PNG (max 10MB) • MP4, MOV (max 50MB)
          </p>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="w-full mt-6 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            'Submit Proof'
          )}
        </button>
      </div>
    </div>
  );
}
