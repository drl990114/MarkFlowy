import classNames from 'classnames'
import Image from 'next/image'

import { Links } from '@/components/links'
import type { ParagraphProps } from '@/components/paragraph'
import { Section } from '@/components/section'

export function ParagraphFeature({ paragraph, ...props }: ParagraphProps) {
  return (
    <Section
      data-cy="paragraph-feature"
      backgroundColor={
        paragraph.field_background_color === 'muted' ? 'bg-gray-50' : ''
      }
      {...props}
    >
      <div className="container px-6 mx-auto">
        <div className="grid items-center gap-8 md:grid-flow-col-dense md:grid-cols-2 md:gap-12">
          {paragraph.field_media?.field_media_image && (
            <div
              className={classNames(
                paragraph.field_media_position === 'left'
                  ? 'md:col-start-1'
                  : 'md:col-start-2',
              )}
            >
              <Image
                src={paragraph.field_media.field_media_image.url}
                width={500}
                height={300}
                alt={paragraph.field_media.field_media_image.alt}
                className="rounded-lg"
              />
            </div>
          )}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            {paragraph.field_heading && (
              <h2 className="text-3xl font-black sm:text-4xl lg:text-5xl">
                {paragraph.field_heading}
              </h2>
            )}
            <div className="max-w-md mt-4 text-lg font-light leading-relaxed text-gray-500 sm:text-xl lg:text-2xl">
              {paragraph.field_text}
            </div>
            {paragraph.field_link && <Links links={[paragraph.field_link]} />}
          </div>
        </div>
      </div>
    </Section>
  )
}
