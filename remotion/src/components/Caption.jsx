export const Caption = ({ text }) => {
  if (!text) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 40px',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          color: '#fff',
          fontSize: 44,
          fontWeight: 700,
          lineHeight: 1.4,
          padding: '10px 28px',
          borderRadius: 4,
          textAlign: 'center',
          maxWidth: '90%',
        }}
      >
        {text}
      </span>
    </div>
  );
};
