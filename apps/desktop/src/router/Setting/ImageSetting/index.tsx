import useAppSettingStore from '@/stores/useAppSettingStore'
import { t } from 'i18next'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import InputSettingItem from '../component/SettingItems/Input'
import PathSelectSettingItem from '../component/SettingItems/PathSelect'
import SelectSettingItem from '../component/SettingItems/Select'

export const ImageSetting = () => {
  const { settingData } = useAppSettingStore()
  return (
    <>
      <SettingGroupContainer>
        <div className='setting-group__title'>{t('settings.image.paste_event.label')}</div>
        <SelectSettingItem
          item={{
            key: 'when_paste_image',
            type: 'select',
            title: { i18nKey: 'settings.image.paste_event.when_paste_image.label' },
            desc: { i18nKey: 'settings.image.paste_event.when_paste_image.desc' },
            options: [
              {
                value: 'do_nothing',
                title: t('settings.image.paste_event.when_paste_image.options.do_nothing'),
              },
              {
                value: 'save_to_local_relative',
                title: t(
                  'settings.image.paste_event.when_paste_image.options.save_to_local_relative',
                ),
              },
              {
                value: 'save_to_local_absolute',
                title: t(
                  'settings.image.paste_event.when_paste_image.options.save_to_local_absolute',
                ),
              },
              {
                value: 'paste_as_base64',
                title: t('settings.image.paste_event.when_paste_image.options.paste_as_base64'),
              },
              {
                value: 'save_to_file_relative',
                title: t(
                  'settings.image.paste_event.when_paste_image.options.save_to_file_relative',
                ),
              },
            ] as const,
          }}
        />
        {settingData.when_paste_image === 'save_to_local_relative' ? (
          <InputSettingItem
            item={{
              key: 'paste_image_save_relative_path',
              type: 'input',
              title: { i18nKey: 'settings.image.paste_event.paste_image_save_relative_path.label' },
              desc: { i18nKey: 'settings.image.paste_event.paste_image_save_relative_path.desc' },
            }}
          />
        ) : null}

        {settingData.when_paste_image === 'save_to_file_relative' ? (
          <InputSettingItem
            item={{
              key: 'paste_image_save_relative_path_rule',
              type: 'input',
              prefix: '${documentPath}/',
              valuePreHandle: (value: string) => {
                if (value.includes('${documentPath}/')) {
                  return value.replace('${documentPath}/', '')
                }
                return value
              }, 
              title: {
                i18nKey: 'settings.image.paste_event.paste_image_save_relative_path_rule.label',
              },
              desc: {
                i18nKey: 'settings.image.paste_event.paste_image_save_relative_path_rule.desc',
              },
            }}
          />
        ) : null}

        {settingData.when_paste_image === 'save_to_local_absolute' ? (
          <PathSelectSettingItem
            item={{
              key: 'paste_image_save_absolute_path',
              type: 'path_select',
              title: { i18nKey: 'settings.image.paste_event.paste_image_save_absolute_path.label' },
              desc: { i18nKey: 'settings.image.paste_event.paste_image_save_absolute_path.desc' },
            }}
          />
        ) : null}
      </SettingGroupContainer>

      <SettingGroupContainer>
        <div className='setting-group__title'>{t('settings.image.upload_img.label')}</div>
        <SelectSettingItem
          item={{
            key: 'when_upload_image',
            type: 'select',
            title: { i18nKey: 'settings.image.upload_img.when_upload_image.label' },
            desc: { i18nKey: 'settings.image.upload_img.when_upload_image.desc' },
            options: [
              {
                value: 'save_to_local_absolute',
                title: t(
                  'settings.image.upload_img.when_upload_image.options.save_to_local_absolute',
                ),
              },
              {
                value: 'save_to_local_relative',
                title: t(
                  'settings.image.upload_img.when_upload_image.options.save_to_local_relative',
                ),
              },
              {
                value: 'upload_as_base64',
                title: t('settings.image.upload_img.when_upload_image.options.paste_as_base64'),
              },
              {
                value: 'save_to_file_relative',
                title: t(
                  'settings.image.upload_img.when_upload_image.options.save_to_file_relative',
                ),
              },
            ] as const,
          }}
        />
        {settingData.when_upload_image === 'save_to_local_relative' ? (
          <InputSettingItem
            item={{
              key: 'upload_image_save_relative_path',
              type: 'input',
              title: { i18nKey: 'settings.image.upload_img.upload_image_save_relative_path.label' },
              desc: { i18nKey: 'settings.image.upload_img.upload_image_save_relative_path.desc' },
            }}
          />
        ) : null}

        {settingData.when_upload_image === 'save_to_file_relative' ? (
          <InputSettingItem
            item={{
              key: 'upload_image_save_relative_path_rule',
              type: 'input',
              prefix: '${documentPath}/',
              valuePreHandle: (value: string) => {
                if (value.includes('${documentPath}/')) {
                  return value.replace('${documentPath}/', '')
                }
                return value
              },
              title: {
                i18nKey: 'settings.image.upload_img.upload_image_save_relative_path_rule.label',
              },
              desc: {
                i18nKey: 'settings.image.upload_img.upload_image_save_relative_path_rule.desc',
              },
            }}
          />
        ) : null}

        {settingData.when_upload_image === 'save_to_local_absolute' ? (
          <PathSelectSettingItem
            item={{
              key: 'upload_image_save_absolute_path',
              type: 'path_select',
              title: { i18nKey: 'settings.image.upload_img.upload_image_save_absolute_path.label' },
              desc: { i18nKey: 'settings.image.upload_img.upload_image_save_absolute_path.desc' },
            }}
          />
        ) : null}
      </SettingGroupContainer>
    </>
  )
}
