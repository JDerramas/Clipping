import re

path = 'D:/WhopClipper/OpenChatCut/src/components/dashboard/WayinMomentsStudio.tsx'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace the card edit button
old_card_btn = """                    <button
                      type="button"
                      disabled={loadingClipId === moment.id}
                      onClick={() => handleEditClip(moment)}
                      title="Open in Timeline Editor with all active overlay layers"
                      style={{
                        background: loadingClipId === moment.id ? '#1e293b' : 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        borderRadius: 4,
                        padding: '4px 7px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: loadingClipId === moment.id ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                    >
                      <Icon name="scissors" size={11} /> {loadingClipId === moment.id ? 'Loading...' : 'Edit'}
                    </button>"""

new_card_btn = """                    <button
                      type="button"
                      disabled={loadingClipId === moment.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClip(moment);
                      }}
                      title="Open in Timeline Editor with all active overlay layers"
                      style={{
                        background: loadingClipId === moment.id ? '#1e293b' : 'linear-gradient(135deg, #0284c7, #2563eb)',
                        border: '1px solid #38bdf8',
                        color: '#ffffff',
                        borderRadius: 6,
                        padding: '5px 11px',
                        fontSize: 11.5,
                        fontWeight: 800,
                        cursor: loadingClipId === moment.id ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon name="scissors" size={12} /> {loadingClipId === moment.id ? 'Opening...' : '✂️ Edit'}
                    </button>"""

# 2. Replace the entire preview modal block
modal_pattern = re.compile(
    r'\{\/\* Video Preview Modal with Live Overlays \*\/\}\s*\{previewMoment && \(\(\) => \{.*?\}\)\(\)\}',
    re.DOTALL
)

new_modal_code = """{/* Video Preview Modal with Live Overlays */}
      {previewMoment && (() => {
        const previewFn = previewMoment.filename || currentVideoFilename;
        const videoSrc = `/media/uploads/${previewFn}`;
        return (
          <div
            onClick={() => setPreviewMoment(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            {/* Top Close Button on Overlay */}
            <button
              type="button"
              onClick={() => setPreviewMoment(null)}
              style={{
                position: 'fixed',
                top: 16,
                right: 20,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                zIndex: 10000,
                boxShadow: '0 4px 14px rgba(0,0,0,0.6)'
              }}
            >
              <span>✕</span> Close (Esc)
            </button>

            {/* Compact Modal Box */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#0d0e18',
                border: '1px solid #2d3350',
                borderRadius: 14,
                overflow: 'hidden',
                width: '100%',
                maxWidth: 360,
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '10px 14px',
                background: '#0a0b14',
                borderBottom: '1px solid #1a1d30',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                  {previewMoment.title}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewMoment(null)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#94a3b8',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                  title="Close preview"
                >
                  ✕
                </button>
              </div>

              {/* Compact 9:16 Video Box */}
              <div style={{
                position: 'relative',
                maxHeight: 'min(45vh, 340px)',
                width: '100%',
                aspectRatio: '9 / 16',
                margin: '0 auto',
                background: '#000',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 1
              }}>
                <video
                  src={`${videoSrc}#t=${previewMoment.start}`}
                  controls
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />

                {/* Multi-Layer Overlays in Preview Modal */}
                {overlayLayers.filter(l => l.enabled && l.text.trim()).map((layer) => {
                  const posStyle = getOverlayPositionStyle(layer.position, 12);
                  const sizeStyle = getOverlaySizeStyle(layer.fontSize, true);
                  return (
                    <div
                      key={`modal-${layer.id}`}
                      style={{
                        position: 'absolute',
                        ...posStyle,
                        ...sizeStyle,
                        color: layer.textColor,
                        background: layer.bgColor,
                        backdropFilter: layer.bgColor.includes('rgba') ? 'blur(6px)' : undefined,
                        border: layer.bgColor !== 'transparent' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                        borderRadius: 6,
                        fontWeight: layer.isBold ? 800 : 600,
                        textTransform: layer.isUppercase ? 'uppercase' : 'none',
                        textShadow: layer.bgColor === 'transparent' ? '0 2px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.85)' : undefined,
                        letterSpacing: '0.02em',
                        pointerEvents: 'none',
                        zIndex: 5,
                        maxWidth: '90%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {layer.text}
                    </div>
                  );
                })}
              </div>

              {/* Big High-Visibility Edit Button Footer */}
              <div style={{ padding: '12px 14px', background: '#0a0b14', borderTop: '1px solid #1a1d30', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  disabled={loadingClipId === previewMoment.id}
                  onClick={() => {
                    const m = previewMoment;
                    setPreviewMoment(null);
                    handleEditClip(m);
                  }}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: loadingClipId === previewMoment.id ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(37,99,235,0.45)'
                  }}
                >
                  <Icon name="scissors" size={15} /> {loadingClipId === previewMoment.id ? 'Opening Editor...' : '✂️ OPEN IN VIDEO EDITOR (EDIT THIS CLIP)'}
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const m = previewMoment;
                      setCopyModalMoment(m);
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34d399',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                    title="View & Copy Auto-Generated Title, Description & Hashtags"
                  >
                    <span>📝</span> Title & Desc
                  </button>

                  <a
                    href={videoSrc}
                    download={`Clip_${previewMoment.rank}_${previewMoment.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)}.mp4`}
                    style={{
                      flex: 1,
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#cbd5e1',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      textDecoration: 'none'
                    }}
                  >
                    <Icon name="download" size={12} /> Download
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}"""

# Apply card button replace
if old_card_btn in code:
    code = code.replace(old_card_btn, new_card_btn)
    print("Card button replaced successfully!")
else:
    # Try with CRLF
    code = code.replace(old_card_btn.replace('\n', '\r\n'), new_card_btn.replace('\n', '\r\n'))
    print("Card button replaced with CRLF!")

# Apply modal replace
if modal_pattern.search(code):
    code = modal_pattern.sub(new_modal_code, code)
    print("Preview modal replaced successfully!")
else:
    print("Could not find preview modal pattern!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Patch complete!")
