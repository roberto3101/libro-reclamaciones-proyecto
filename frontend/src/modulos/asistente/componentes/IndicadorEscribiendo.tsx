export default function IndicadorEscribiendo() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '16px 16px 16px 4px',
          backgroundColor: 'var(--ui-superficie, #fffefb)',
          border: '1px solid var(--ui-borde)',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span
          className="animate-bounce"
          style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#29585c', display: 'inline-block',
            animationDelay: '0ms',
          }}
        />
        <span
          className="animate-bounce"
          style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#29585c', display: 'inline-block',
            animationDelay: '150ms',
          }}
        />
        <span
          className="animate-bounce"
          style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#29585c', display: 'inline-block',
            animationDelay: '300ms',
          }}
        />
      </div>
    </div>
  );
}