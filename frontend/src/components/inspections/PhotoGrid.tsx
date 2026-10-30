'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImagePlus, Loader2, X } from 'lucide-react'

import { deletePhoto } from '@/app/inspections/actions'
import { MAX_PHOTOS_PER_ITEM, validatePhotoFile } from '@/lib/inspection-schemas'
import type { Photo } from '@/lib/inspection-data'
import { Button } from '@/components/ui/button'

interface Props {
  inspectionId: string
  itemId: string
  photos: Photo[]
  readOnly: boolean
}

export function PhotoGrid({ inspectionId, itemId, photos, readOnly }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const full = photos.length >= MAX_PHOTOS_PER_ITEM

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const invalid = validatePhotoFile(file)
        if (invalid) {
          toast.error(`${file.name}: ${invalid}`)
          continue
        }
        const body = new FormData()
        body.append('file', file)
        const res = await fetch(`/api/inspections/${inspectionId}/items/${itemId}/photos`, { method: 'POST', body })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'Erro ao enviar a foto.' }))
          toast.error(`${file.name}: ${error}`)
          if (res.status === 422 || res.status === 409) break
        }
      }
      router.refresh()
    } catch {
      toast.error('Erro ao enviar a foto.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onDelete(photoId: string) {
    const result = await deletePhoto(inspectionId, itemId, photoId)
    if (result.error) toast.error(result.error)
    else toast.success('Foto removida.')
  }

  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p) => (
        <div key={p.id} className="relative">
          <a href={`/api/inspection-photos/${p.id}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem autenticada servida pela rota proxy */}
            <img
              src={`/api/inspection-photos/${p.id}`}
              alt={`Foto: ${p.filename}`}
              loading="lazy"
              className="h-20 w-20 rounded-md border object-cover"
            />
          </a>
          {!readOnly && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -right-2 -top-2 h-5 w-5 rounded-full"
              aria-label={`Remover foto ${p.filename}`}
              onClick={() => onDelete(p.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-20 w-20 flex-col gap-1 text-xs"
            disabled={uploading || full}
            title={full ? `Máximo de ${MAX_PHOTOS_PER_ITEM} fotos` : 'Adicionar fotos (até 10 MB cada)'}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {photos.length}/{MAX_PHOTOS_PER_ITEM}
          </Button>
        </>
      )}
      {readOnly && photos.length === 0 && <span className="text-xs text-muted-foreground">Sem fotos</span>}
    </div>
  )
}
