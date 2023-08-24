import Image from 'next/image'

import { Links } from '@/components/links'
import type { ParagraphProps } from '@/components/paragraph'
import { Section } from '@/components/section'

export function ParagraphFeature({ paragraph, ...props }: ParagraphProps) {
  const renderImage = (field_media_image: FieldMediaImg) => {
    return (
      <div className='flex flex-1 justify-center'>
        <Image
          src={field_media_image.url}
          width={field_media_image.width || 300}
          height={field_media_image.height || 300}
          alt={field_media_image.alt}
          className='rounded-lg drop-shadow'
        />
      </div>
    )
  }

  const renderInfo = () => {
    return (
      <div className='flex flex-1 flex-col items-center text-center md:items-start md:text-left'>
        {paragraph.field_heading && (
          <h2 className='text-3xl sm:text-4xl lg:text-5xl'>{paragraph.field_heading}</h2>
        )}
        <div className='max-w-md mt-4 text-lg leading-relaxed text-gray-500 sm:text-xl lg:text-2xl'>
          {paragraph.field_text}
        </div>
        {paragraph.field_link && <Links links={[paragraph.field_link]} />}
      </div>
    )
  }

  return (
    <Section
      data-cy='paragraph-feature'
      backgroundColor={paragraph.field_background_color === 'muted' ? 'bg-gray-50' : ''}
      {...props}
    >
      <div className='container px-6 mx-auto'>
        <div className='flex justify-between'>
          {paragraph.field_media_position !== 'left' ? (
            <>
              {renderInfo()}
              {paragraph.field_media?.field_media_image &&
                renderImage(paragraph.field_media?.field_media_image)}
            </>
          ) : (
            <>
              {paragraph.field_media?.field_media_image &&
                renderImage(paragraph.field_media?.field_media_image)}
              {renderInfo()}
            </>
          )}
        </div>
      </div>
    </Section>
  )
}
