'use client';

export function SocialProof() {
  return (
    <section className="py-20 border-y border-slate-800 bg-[#0F172A] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-10">Built for growing D2C brands</p>
        
        {/* Infinite Marquee implementation */}
        <div className="relative flex overflow-x-hidden group">
          <div className="animate-marquee whitespace-nowrap flex items-center justify-around gap-16 min-w-full opacity-40 grayscale group-hover:opacity-60 transition-opacity duration-500">
            <span className="text-2xl font-bold font-serif tracking-tight text-white">Minimalist.</span>
            <span className="text-2xl font-black italic tracking-tighter text-white">FITNESS+</span>
            <span className="text-2xl font-bold tracking-widest text-white">GLOW</span>
            <span className="text-2xl font-light tracking-[0.3em] text-white">NATURE</span>
            <span className="text-2xl font-extrabold tracking-tighter text-white">KetoInd</span>
            {/* Duplicate for seamless looping */}
            <span className="text-2xl font-bold font-serif tracking-tight text-white">Minimalist.</span>
            <span className="text-2xl font-black italic tracking-tighter text-white">FITNESS+</span>
            <span className="text-2xl font-bold tracking-widest text-white">GLOW</span>
          </div>

          <div className="absolute top-0 animate-marquee2 whitespace-nowrap flex items-center justify-around gap-16 min-w-full opacity-40 grayscale group-hover:opacity-60 transition-opacity duration-500">
            <span className="text-2xl font-bold font-serif tracking-tight text-white">Minimalist.</span>
            <span className="text-2xl font-black italic tracking-tighter text-white">FITNESS+</span>
            <span className="text-2xl font-bold tracking-widest text-white">GLOW</span>
            <span className="text-2xl font-light tracking-[0.3em] text-white">NATURE</span>
            <span className="text-2xl font-extrabold tracking-tighter text-white">KetoInd</span>
            <span className="text-2xl font-bold font-serif tracking-tight text-white">Minimalist.</span>
            <span className="text-2xl font-black italic tracking-tighter text-white">FITNESS+</span>
            <span className="text-2xl font-bold tracking-widest text-white">GLOW</span>
          </div>
        </div>

      </div>
    </section>
  );
}
