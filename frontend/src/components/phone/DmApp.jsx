import { MessageCircle } from 'lucide-react';

// Placeholder until the messaging backend lands (later phase).
export function DmApp() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-3">
      <div className="flex items-center justify-center rounded-2xl"
        style={{ width: 64, height: 64, background: 'rgba(79,209,197,0.16)', border: '1px solid rgba(79,209,197,0.4)' }}>
        <MessageCircle size={28} style={{ color: '#4FD1C5' }} />
      </div>
      <div className="me-display font-bold text-base">메시지</div>
      <div className="text-[12px] text-muted leading-relaxed">
        곧 만나요! 소속사와 동료 아티스트, 협업 제안이 여기로 도착하는 메시지함이 준비 중이에요.
      </div>
    </div>
  );
}
