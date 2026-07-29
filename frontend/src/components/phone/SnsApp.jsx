import { Camera } from 'lucide-react';

// Placeholder until the SNS backend + real feed land (next phase). Kept as its
// own component so swapping in the real app is a one-file change.
export function SnsApp() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-3">
      <div className="flex items-center justify-center rounded-2xl"
        style={{ width: 64, height: 64, background: 'rgba(232,147,166,0.16)', border: '1px solid rgba(232,147,166,0.4)' }}>
        <Camera size={28} style={{ color: '#E893A6' }} />
      </div>
      <div className="me-display font-bold text-base">뮤즈그램</div>
      <div className="text-[12px] text-muted leading-relaxed">
        곧 만나요! 사진과 근황을 올리고, 다른 아티스트를 팔로우하고, 좋아요·댓글을 주고받는
        SNS가 준비 중이에요.
      </div>
    </div>
  );
}
