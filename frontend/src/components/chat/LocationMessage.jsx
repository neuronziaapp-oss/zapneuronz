import React, { useState } from 'react';

const PALETTE_VARIANTS = {
  fromMe: {
    container: 'bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 border-emerald-200 shadow-emerald-100/70',
    accent: 'bg-emerald-300/80',
    icon: 'bg-emerald-500/10 text-emerald-600',
    badge: 'bg-emerald-50/90 border-emerald-200 text-emerald-700',
    button: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    fallback: 'from-emerald-100/60 via-white to-emerald-200/60 border-emerald-200 text-emerald-700'
  },
  received: {
    container: 'bg-gradient-to-br from-white via-white to-sky-50 border-slate-200 shadow-sky-100/70',
    accent: 'bg-sky-300/70',
    icon: 'bg-sky-500/10 text-sky-600',
    badge: 'bg-sky-50/90 border-sky-200 text-sky-700',
    button: 'bg-sky-500 hover:bg-sky-600 text-white',
    fallback: 'from-sky-50/80 via-white to-sky-100/80 border-sky-200 text-sky-700'
  }
};

const LocationMessage = ({ message, isFromMe = false, timestamp = null }) => {
  const [thumbnailError, setThumbnailError] = useState(false);

  const rawLocation = message.location || message.message?.locationMessage || message.message?.contextInfo?.quotedMessage?.locationMessage || null;

  const latitudeValue = rawLocation?.latitude ?? rawLocation?.degreesLatitude ?? rawLocation?.lat ?? null;
  const longitudeValue = rawLocation?.longitude ?? rawLocation?.degreesLongitude ?? rawLocation?.lng ?? null;

  const latitude = typeof latitudeValue === 'string' ? parseFloat(latitudeValue) : latitudeValue;
  const longitude = typeof longitudeValue === 'string' ? parseFloat(longitudeValue) : longitudeValue;

  if (typeof latitude !== 'number' || Number.isNaN(latitude) || typeof longitude !== 'number' || Number.isNaN(longitude)) {
    console.warn('Mensagem sem dados de localização válidos:', message);
    return <p className="text-sm">Localização indisponível</p>;
  }

  const palette = isFromMe ? PALETTE_VARIANTS.fromMe : PALETTE_VARIANTS.received;

  const label = rawLocation?.label || rawLocation?.name || rawLocation?.address || (message.content?.startsWith('📍') ? message.content.slice(2).trim() : null);

  const baseMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const googleMapsUrl = message.mapsUrl || rawLocation?.url || baseMapsUrl;

  const rawThumbnail = rawLocation?.thumbnail || rawLocation?.jpegThumbnail || message.locationThumbnail;
  const thumbnailSrc = !thumbnailError && rawThumbnail && rawThumbnail.length > 100
    ? (rawThumbnail.startsWith('data:') ? rawThumbnail : `data:image/jpeg;base64,${rawThumbnail}`)
    : null;

  const coordinateText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className={`relative overflow-hidden rounded-2xl border shadow-md ${palette.container}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${palette.accent}`} aria-hidden="true" />

      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${palette.icon}`}>
          <span className="text-xl leading-none">📍</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800">Localização compartilhada</span>
          <span className="text-xs text-slate-500">Clique para visualizar no mapa</span>
        </div>
      </div>

      <div className="px-4 pb-4">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir localização no Google Maps"
          className="group block"
        >
          <div className={`relative overflow-hidden rounded-xl border ${palette.badge} shadow-inner transition-transform duration-500 group-hover:-translate-y-0.5`}>
            {thumbnailSrc ? (
              <img
                src={thumbnailSrc}
                alt={label ? `Localização: ${label}` : 'Localização'}
                className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                onError={() => setThumbnailError(true)}
              />
            ) : (
              <div className={`flex h-44 w-full flex-col items-center justify-center bg-gradient-to-br ${palette.fallback} gap-2 text-center text-sm font-medium`}>
                <span className="text-3xl">📍</span>
                <span>{label || 'Localização compartilhada'}</span>
                <span className="text-xs font-normal opacity-70">Clique para abrir no mapa</span>
              </div>
            )}
          </div>
        </a>

        <div className="mt-4 space-y-3">
          {/* <div className="flex flex-wrap items-center gap-2">
            {label && (
              <span className="text-sm font-semibold text-slate-800">{label}</span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${palette.badge}`}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M10 2a6 6 0 00-6 6c0 4.12 5.14 9.38 5.36 9.6.36.36.94.36 1.3 0C10.86 17.38 16 12.12 16 8a6 6 0 00-6-6zm0 8.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
              </svg>
              {coordinateText}
            </span>
          </div> */}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-slate-500">
              Compartilhado via WhatsApp • {label ? 'Detalhes da localização acima.' : 'Coordenadas exatas exibidas acima.'}
            </p>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-sm transition ${palette.button}`}
            >
              Abrir no Google Maps
            </a>
          </div>

          {formattedTime && (
            <div className="flex justify-end">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">{formattedTime}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationMessage;