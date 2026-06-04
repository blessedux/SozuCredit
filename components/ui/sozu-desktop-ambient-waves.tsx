/** Desktop-only CSS ambient color waves (no WebGL). Hidden below md. */
export function SozuDesktopAmbientWaves() {
  return (
    <div aria-hidden className="sozu-desktop-waves">
      <div className="sozu-desktop-waves__layer sozu-desktop-waves__layer--a" />
      <div className="sozu-desktop-waves__layer sozu-desktop-waves__layer--b" />
      <div className="sozu-desktop-waves__layer sozu-desktop-waves__layer--c" />
    </div>
  )
}
