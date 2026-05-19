import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { ChevronRight, Maximize2, Sparkle, X } from 'lucide-react'
import { FileIcon, type FileLanguage } from './file-icon'
import type { FeatureSpotlight } from '@/content/site'

interface FeatureShowcaseProps {
  features: FeatureSpotlight[]
  /** Logical key → resolved Vite asset URL (resolved by the page). */
  images: Record<FeatureSpotlight['imageKey'], string>
  /** Section heading label shown next to the sparkle marker. */
  introLabel: string
  /** Initial selected feature id. Defaults to first item. */
  defaultActiveId?: string
}

const LANG_TO_ICON: Record<FeatureSpotlight['language'], FileLanguage> = {
  tsx: 'typescript',
  json: 'json',
  md: 'markdown'
}

export function FeatureShowcase({
  features,
  images,
  introLabel,
  defaultActiveId
}: FeatureShowcaseProps) {
  const tablistId = useId()
  const [activeId, setActiveId] = useState<string>(defaultActiveId ?? features[0]?.id ?? '')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const activeIndex = useMemo(
    () => Math.max(0, features.findIndex((f) => f.id === activeId)),
    [features, activeId]
  )
  const active = features[activeIndex] ?? features[0]

  const focusTab = useCallback(
    (index: number) => {
      const wrapped = (index + features.length) % features.length
      setActiveId(features[wrapped].id)
      requestAnimationFrame(() => {
        tabRefs.current[wrapped]?.focus()
      })
    },
    [features]
  )

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        focusTab(activeIndex + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        focusTab(activeIndex - 1)
        break
      case 'Home':
        event.preventDefault()
        focusTab(0)
        break
      case 'End':
        event.preventDefault()
        focusTab(features.length - 1)
        break
    }
  }

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
    requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }, [])

  if (!active) return null

  const panelId = `${tablistId}-panel-${active.id}`
  const stepLabel = `${activeIndex + 1} / ${features.length}`

  return (
    <div className="vsc-spotlight">
      <div
        className="vsc-spotlight-list"
        role="tablist"
        aria-orientation="vertical"
        aria-label={introLabel}
        onKeyDown={onKeyDown}
      >
        <div className="vsc-spotlight-list-head">
          <Sparkle size={12} strokeWidth={1.75} aria-hidden="true" />
          <span>{introLabel}</span>
          <span className="vsc-spotlight-counter" aria-hidden="true">
            {stepLabel}
          </span>
        </div>
        {features.map((feature, idx) => {
          const isActive = feature.id === active.id
          return (
            <button
              key={feature.id}
              ref={(node) => {
                tabRefs.current[idx] = node
              }}
              type="button"
              role="tab"
              id={`${tablistId}-tab-${feature.id}`}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              className={`vsc-spotlight-step${isActive ? ' is-active' : ''}`}
              onClick={() => setActiveId(feature.id)}
            >
              <span className="vsc-spotlight-step-num" aria-hidden="true">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="vsc-spotlight-step-body">
                <span className="vsc-spotlight-step-file">
                  <FileIcon language={LANG_TO_ICON[feature.language]} size={13} />
                  <span className="vsc-spotlight-step-filename">{feature.fileLabel}</span>
                </span>
                <span className="vsc-spotlight-step-title">{feature.title}</span>
              </span>
              <ChevronRight
                size={14}
                strokeWidth={1.75}
                className="vsc-spotlight-step-chevron"
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      <div
        className="vsc-spotlight-preview"
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${tablistId}-tab-${active.id}`}
      >
        <button
          ref={triggerRef}
          type="button"
          className="vsc-spotlight-image-trigger"
          onClick={() => setLightboxOpen(true)}
          aria-label={`View ${active.fileLabel} screenshot at full size`}
        >
          <img
            key={active.id}
            src={images[active.imageKey]}
            alt={active.imageAlt}
            className="vsc-spotlight-image"
            decoding="async"
            loading="lazy"
          />
          <span className="vsc-spotlight-zoom" aria-hidden="true">
            <Maximize2 size={14} strokeWidth={1.75} />
          </span>
        </button>

        <div className="vsc-spotlight-detail" key={`${active.id}-detail`}>
          <h3 className="vsc-spotlight-title">{active.title}</h3>
          <p className="vsc-spotlight-summary">{active.summary}</p>
          <ul className="vsc-spotlight-bullets">
            {active.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </div>

      {lightboxOpen ? (
        <Lightbox
          src={images[active.imageKey]}
          alt={active.imageAlt}
          caption={`${active.fileLabel} · ${active.title}`}
          onClose={closeLightbox}
        />
      ) : null}
    </div>
  )
}

interface LightboxProps {
  src: string
  alt: string
  caption: string
  onClose: () => void
}

function Lightbox({ src, alt, caption, onClose }: LightboxProps) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeBtnRef.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="vsc-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      onClick={onClose}
    >
      <button
        ref={closeBtnRef}
        type="button"
        className="vsc-lightbox-close"
        aria-label="Close"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      <figure
        className="vsc-lightbox-figure"
        onClick={(event) => event.stopPropagation()}
      >
        <img src={src} alt={alt} className="vsc-lightbox-image" decoding="async" />
        <figcaption className="vsc-lightbox-caption">{caption}</figcaption>
      </figure>
    </div>
  )
}
