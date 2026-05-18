import type { ComponentProps } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faApple,
  faArchLinux,
  faCentos,
  faDebian,
  faFedora,
  faLinux,
  faRedhat,
  faSuse,
  faUbuntu
} from '@fortawesome/free-brands-svg-icons'
import { type ServerBrandId } from '@shared/server-brands'
import { cn } from '@/lib/utils'
import { resolveServerBrandId } from '@/lib/server-brand'

const brandIcons = {
  archlinux: faArchLinux,
  centos: faCentos,
  debian: faDebian,
  fedora: faFedora,
  linux: faLinux,
  macos: faApple,
  redhat: faRedhat,
  suse: faSuse,
  ubuntu: faUbuntu
} satisfies Record<ServerBrandId, typeof faLinux>

interface ServerBrandIconProps extends ComponentProps<'span'> {
  brandId?: ServerBrandId | null
  customIconDataUrl?: string | null
  iconClassName?: string
}

export function ServerBrandIcon({
  brandId,
  className,
  customIconDataUrl,
  iconClassName,
  ...props
}: ServerBrandIconProps) {
  const resolvedBrandId = resolveServerBrandId(brandId)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-[var(--workbench-muted)]',
        className
      )}
      aria-hidden="true"
      {...props}
    >
      {customIconDataUrl ? (
        <img
          alt=""
          src={customIconDataUrl}
          className={cn('size-full rounded-sm object-contain', iconClassName)}
        />
      ) : (
        <FontAwesomeIcon
          icon={brandIcons[resolvedBrandId]}
          className={cn('size-full', iconClassName)}
        />
      )}
    </span>
  )
}
