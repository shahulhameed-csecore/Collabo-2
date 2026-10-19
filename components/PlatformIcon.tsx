import { Play, Video, Image as ImageIcon, Music, Smartphone } from 'lucide-react';

interface PlatformIconProps {
  platform?: string | null;
  className?: string;
  fallbackToImage?: boolean;
}

export function PlatformIcon({ platform, className = "w-4 h-4", fallbackToImage = true }: PlatformIconProps) {
  const p = platform?.toLowerCase() || '';
  
  if (p.includes('instagram') || p.includes('reel') || p.includes('story') || p.includes('ig')) {
    return <Play className={className} />;
  }
  
  if (p.includes('youtube') || p.includes('shorts') || p.includes('yt')) {
    return <Video className={className} />;
  }
  
  if (p.includes('tiktok')) {
    return <Music className={className} />; 
  }

  if (p.includes('twitter') || p.includes('x.com') || p.includes('blog') || p.includes('pinterest') || p.includes('snapchat')) {
    return <Smartphone className={className} />;
  }

  if (p || fallbackToImage) {
    return <ImageIcon className={className} />;
  }

  return null;
}
