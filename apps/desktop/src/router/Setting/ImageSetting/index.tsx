import useAppSettingStore from '@/stores/useAppSettingStore'
import { t } from 'i18next'
import { SettingGroupContainer } from '../component/SettingGroup/styles'
import InputSettingItem from '../component/SettingItems/Input'
import PathSelectSettingItem from '../component/SettingItems/PathSelect'
import SelectSettingItem from '../component/SettingItems/Select'

export const ImageSetting = () => {
  const { settingData } = useAppSettingStore()
  return (
    <SettingGroupContainer>
      <div className='setting-group__title'>{t('settings.image.event.label')}</div>
      <SelectSettingItem
        item={{
          key: 'when_paste_image',
          type: 'select',
          title: { i18nKey: 'settings.image.event.when_paste_image.label' },
          desc: { i18nKey: 'settings.image.event.when_paste_image.desc' },
          options: [
            {
              value: 'do_nothing',
              title: t('settings.image.event.when_paste_image.options.do_nothing'),
            },
            {
              value: 'save_to_local_relative',
              title: t('settings.image.event.when_paste_image.options.save_to_local_relative'),
            },
            {
              value: 'save_to_local_absolute',
              title: t('settings.image.event.when_paste_image.options.save_to_local_absolute'),
            },
            {
              value: 'paste_as_base64',
              title: t('settings.image.event.when_paste_image.options.paste_as_base64'),
            },
            {
              value: 'save_to_file_relative',
              title: t('settings.image.event.when_paste_image.options.save_to_file_relative')
            }
          ] as const,
        }}
      />
      {settingData.when_paste_image === 'save_to_local_relative' ? (
        <InputSettingItem
          item={{
            key: 'paste_image_save_relative_path',
            type: 'input',
            title: { i18nKey: 'settings.image.event.paste_image_save_relative_path.label' },
            desc: { i18nKey: 'settings.image.event.paste_image_save_relative_path.desc' },
          }}
        />
      ) : null}

      {settingData.when_paste_image === 'save_to_file_relative' ? (
        <InputSettingItem
          item={{
            key: 'paste_image_save_relative_path_rule',
            type: 'input',
            title: { i18nKey: 'settings.image.event.paste_image_save_relative_path_rule.label' },
            desc: { i18nKey: 'settings.image.event.paste_image_save_relative_path_rule.desc' },
          }}
        />
      ) : null}

      {settingData.when_paste_image === 'save_to_local_absolute' ? (
        <PathSelectSettingItem
          item={{
            key: 'paste_image_save_absolute_path',
            type: 'path_select',
            title: { i18nKey: 'settings.image.event.paste_image_save_absolute_path.label' },
            desc: { i18nKey: 'settings.image.event.paste_image_save_absolute_path.desc' },
          }}
        />
      ) : null}
    </SettingGroupContainer>
  )
}
