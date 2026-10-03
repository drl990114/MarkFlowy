import { EditorViewType } from '@/constants/editorViewType'
import { DEFAULT_CURRENT_DATE_FORMAT } from '@/helper/date'
import { changeLng, i18n, locales, type Langs } from '@/i18n'
import { currentWebview } from '@/services/windows'

/** Defaults shown by Desktop: Markdown uses Capricorn, full source uses RME. */
export interface CodeEditorSettingDefaults {
  bodyFontSize?: string
  codeBlockLineWrapping?: boolean
  personalTypography?: boolean
}

const defaultCodeValue = (value: string, translate: typeof i18n.t) =>
  translate('settings.editor.code_editing.default_value', { value })

const getCodeDisplaySettings = (
  scope: 'source' | 'embedded',
  translate: typeof i18n.t,
  mixedWrapping = false,
) => ({
  lineWrap: {
    key: `${scope}_code_editor_line_wrap`,
    type: 'select' as const,
    defaultValue: 'default',
    title: { i18nKey: 'settings.editor.code_editing.line_wrap.label' },
    desc: { i18nKey: mixedWrapping
      ? 'settings.editor.code_editing.line_wrap.mixed_desc'
      : 'settings.editor.code_editing.line_wrap.desc' },
    options: ['default', 'on', 'off'].map((value) => ({
      value,
      title: value === 'default'
        ? mixedWrapping
          ? translate('settings.editor.code_editing.line_wrap.mixed_default')
          : defaultCodeValue(translate('settings.editor.code_editing.on'), translate)
        : translate(`settings.editor.code_editing.${value}`),
    })),
  },
  lineNumbers: {
    key: `${scope}_code_editor_line_numbers`,
    type: 'select' as const,
    defaultValue: 'default',
    title: { i18nKey: 'settings.editor.code_editing.line_numbers.label' },
    desc: { i18nKey: 'settings.editor.code_editing.line_numbers.desc' },
    options: ['default', 'off', 'all', 'sparse'].map((value) => ({
      value,
      title: value === 'default'
        ? defaultCodeValue(translate(
          `settings.editor.code_editing.line_numbers.${scope === 'source' ? 'sparse' : 'all'}`,
        ), translate)
        : translate(value === 'off'
          ? 'settings.editor.code_editing.off'
          : `settings.editor.code_editing.line_numbers.${value}`),
    })),
  },
  highlightActiveLine: {
    key: `${scope}_code_editor_highlight_active_line`,
    type: 'select' as const,
    defaultValue: 'default',
    title: { i18nKey: 'settings.editor.code_editing.active_line.label' },
    desc: { i18nKey: 'settings.editor.code_editing.active_line.desc' },
    options: ['default', 'on', 'off'].map((value) => ({
      value,
      title: value === 'default'
        ? defaultCodeValue(translate('settings.editor.code_editing.on'), translate)
        : translate(`settings.editor.code_editing.${value}`),
    })),
  },
})

export const getSettingMap = (
  defaults: CodeEditorSettingDefaults = {},
  translate: typeof i18n.t = i18n.t,
) => {
  const bodyFontSize = defaults.bodyFontSize ?? '16px'
  const pixels = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(bodyFontSize)
  const codeFontSize = pixels ? Number(pixels[1]) * 0.875 : undefined
  const codeFontSizeLabel = codeFontSize && Number.isFinite(codeFontSize)
    ? translate('settings.editor.code_editing.font_size.default', {
      value: Number(codeFontSize.toFixed(3)),
    })
    : translate('settings.editor.code_editing.font_size.relative_default')
  const typographyNote = defaults.personalTypography === false
    ? translate('settings.editor.code_editing.typography_disabled')
    : undefined

  return {
    general: {
      i18nKey: 'settings.general.label',
      iconName: 'ri-equalizer-line',
      desc: {
        i18nKey: 'settings.general.desc',
      },
      App: {
        i18nKey: 'settings.general.app.label',
        auto_update: {
          key: 'auto_update',
          title: {
            i18nKey: 'settings.general.app.automatic_updates.label',
          },
          desc: {
            i18nKey: 'settings.general.app.automatic_updates.desc',
          },
          type: 'switch',
        },
        error_reporting_enabled: {
          key: 'error_reporting_enabled',
          title: { i18nKey: 'settings.general.app.error_reporting.label' },
          desc: { i18nKey: 'settings.general.app.error_reporting.desc' },
          type: 'switch',
        },
      },
      Startup: {
        i18nKey: 'settings.general.startup.label',
        leftStartup: {
          key: 'leftStartup',
          storage: 'layout',
          type: 'select',
          title: { i18nKey: 'settings.general.startup.left' },
          desc: { i18nKey: 'settings.general.startup.description' },
          options: [
            { value: 'restore', title: translate('settings.general.startup.restore') },
            { value: 'explorer', title: translate('sidebar.explorer') },
            { value: 'search', title: translate('sidebar.search') },
            { value: 'bookmarks', title: translate('sidebar.bookmarks') },
          ],
        },
        rightStartup: {
          key: 'rightStartup',
          storage: 'layout',
          type: 'select',
          title: { i18nKey: 'settings.general.startup.right' },
          desc: { i18nKey: 'settings.general.startup.description' },
          options: [
            { value: 'restore', title: translate('settings.general.startup.restore') },
            { value: 'toc', title: translate('sidebar.table_of_contents') },
            { value: 'ai', title: translate('ai.assistant') },
          ],
        },
      },
      'Auto Save': {
        i18nKey: 'settings.general.autosave.label',
        autosave: {
          key: 'autosave',
          title: {
            i18nKey: 'settings.general.autosave.switch_auto_save.label',
          },
          desc: {
            i18nKey: 'settings.general.autosave.switch_auto_save.desc',
          },
          type: 'switch',
        },
        autosaveInterval: {
          key: 'autosave_interval',
          type: 'slider',
          title: {
            i18nKey: 'settings.general.autosave.autosaveInterval.label',
          },
          desc: {
            i18nKey: 'settings.general.autosave.autosaveInterval.desc',
          },
          scope: [1000, 10000],
        },
      },
      Misc: {
        i18nKey: 'settings.general.misc.label',
        language: {
          key: 'language',
          type: 'select',
          title: {
            i18nKey: 'settings.general.misc.language.label',
          },
          desc: {
            i18nKey: 'settings.general.misc.language.desc',
          },
          options: Object.keys(locales).map((key) => ({
            value: key,
            title: locales[key as keyof typeof locales],
          })),
          afterWrite: (val: Langs) => {
            changeLng(val)
          },
        },
        fileExcludePatterns: {
          key: 'file_exclude_patterns',
          type: 'listInput',
          placeholderI18nKey: 'settings.general.misc.file_exclude_patterns.placeholder',
          title: {
            i18nKey: 'settings.general.misc.file_exclude_patterns.label',
          },
          desc: {
            i18nKey: 'settings.general.misc.file_exclude_patterns.desc',
          },
          i18nProps: {
            add: 'common.addPattern',
          },
        },
      },
    },
    display: {
      i18nKey: 'settings.display.label',
      iconName: 'ri-window-line',
      desc: {
        i18nKey: 'settings.display.desc',
      },
      Theme: {
        i18nKey: 'settings.display.theme.label',
      },
      size: {
        i18nKey: 'settings.display.size.label',
        zoom: {
          key: 'webview_zoom',
          type: 'slider',
          title: {
            i18nKey: 'settings.display.size.zoom.label',
          },
          desc: {
            i18nKey: 'settings.display.size.zoom.desc',
          },
          step: 0.1,
          saveToString: true,
          scope: [0.5, 2],
          afterWrite: (val: string) => {
            currentWebview.setZoom(Number(val))
          },
        },
      },
    },
    snippets: {
      i18nKey: 'snippets.library',
      iconName: 'ri-code-box-line',
      desc: { i18nKey: 'snippets.description' },
    },
    themeStore: {
      i18nKey: 'settings.themeStore.label',
      iconName: 'ri-palette-line',
      desc: {
        i18nKey: 'settings.themeStore.desc',
      },
    },
    editor: {
      i18nKey: 'settings.editor.label',
      iconName: 'ri-edit-box-line',
      desc: {
        i18nKey: 'settings.editor.desc',
      },
      Style: {
        i18nKey: 'settings.editor.style.label',
        fullWidth: {
          key: 'editor_full_width',
          type: 'switch',
          title: {
            i18nKey: 'settings.editor.style.full_width.label',
          },
          desc: {
            i18nKey: 'settings.editor.style.full_width.desc',
          },
        },
        fontSize: {
          key: 'editor_root_font_size',
          type: 'slider',
          title: {
            i18nKey: 'settings.editor.style.font_size.label',
          },
          desc: {
            i18nKey: 'settings.editor.style.font_size.desc',
          },
          scope: [12, 40],
        },
        lineHeight: {
          key: 'editor_root_line_height',
          type: 'slider',
          title: {
            i18nKey: 'settings.editor.style.line_height.label',
          },
          desc: {
            i18nKey: 'settings.editor.style.line_height.desc',
          },
          step: 0.1,
          saveToString: true,
          scope: [1, 2],
        },
        normalFontFamily: {
          key: 'editor_root_font_family',
          type: 'fontListSelect',
          title: {
            i18nKey: 'settings.editor.style.font_family.label',
          },
          desc: {
            i18nKey: 'settings.editor.style.font_family.desc',
          },
        },
        codeFontFamily: {
          key: 'editor_code_font_family',
          type: 'fontListSelect',
          title: {
            i18nKey: 'settings.editor.style.code_font_family.label',
          },
          desc: {
            i18nKey: 'settings.editor.style.code_font_family.desc',
          },
        },
      },
      Behavior: {
        i18nKey: 'settings.editor.behavior.label',
        mdDefaultMode: {
          key: 'md_editor_default_mode',
          type: 'select',
          title: {
            i18nKey: 'settings.editor.behavior.md_default_mode.label',
          },
          desc: {
            i18nKey: 'settings.editor.behavior.md_default_mode.desc',
          },
          options: [
            { value: EditorViewType.WYSIWYG, title: translate('view.wysiwyg') },
            { value: EditorViewType.SOURCECODE, title: translate('view.source_code') },
            { value: EditorViewType.PREVIEW, title: translate('view.preview') },
          ],
        },
        typewriterScroll: {
          key: 'editor_typewriter_scroll',
          type: 'switch',
          title: {
            i18nKey: 'settings.editor.behavior.typewriter_scroll.label',
          },
          desc: {
            i18nKey: 'settings.editor.behavior.typewriter_scroll.desc',
          },
        },
        linkEditMode: {
          key: 'editor_link_edit_mode',
          type: 'select',
          title: { i18nKey: 'link_editing.label' },
          desc: { i18nKey: 'link_editing.description' },
          options: [
            { value: 'popover', title: translate('link_editing.popover') },
            { value: 'markdown', title: translate('link_editing.markdown') },
          ],
        },
        textDirection: {
          key: 'editor_text_direction',
          type: 'select',
          title: { i18nKey: 'settings.editor.behavior.text_direction.label' },
          desc: { i18nKey: 'settings.editor.behavior.text_direction.desc' },
          options: [
            { value: 'auto', title: translate('settings.editor.behavior.text_direction.auto') },
            { value: 'ltr', title: translate('settings.editor.behavior.text_direction.ltr') },
            { value: 'rtl', title: translate('settings.editor.behavior.text_direction.rtl') },
          ],
        },
        placeholder: {
          key: 'editor_placeholder',
          type: 'switch',
          title: {
            i18nKey: 'settings.editor.behavior.placeholder.label',
          },
          desc: {
            i18nKey: 'settings.editor.behavior.placeholder.desc',
          },
        },
        insertDateFormat: {
          key: 'editor_insert_date_format',
          type: 'dateFormat',
          placeholder: DEFAULT_CURRENT_DATE_FORMAT,
          title: {
            i18nKey: 'settings.editor.behavior.insert_date_format.label',
          },
          desc: {
            i18nKey: 'settings.editor.behavior.insert_date_format.desc',
          },
        },
      },
      CodeEditing: {
        i18nKey: 'settings.editor.code_editing.label',
        indentStyle: {
          key: 'editor_code_indent_style',
          type: 'select',
          defaultValue: 'spaces',
          title: { i18nKey: 'settings.editor.code_editing.indent_style.label' },
          desc: { i18nKey: 'settings.editor.code_editing.indent_style.desc' },
          options: ['spaces', 'tabs'].map((value) => ({
            value,
            title: translate(`settings.editor.code_editing.indent_style.${value}`),
          })),
        },
        indentSize: {
          key: 'editor_code_indent_size',
          type: 'select',
          defaultValue: 'default',
          title: { i18nKey: 'settings.editor.code_editing.indent_size.label' },
          desc: { i18nKey: 'settings.editor.code_editing.indent_size.desc' },
          options: ['default', '2', '4', '8'].map((value) => ({
            value,
            title: value === 'default'
              ? translate('settings.editor.code_editing.indent_size.default')
              : value,
          })),
        },
        autoCloseBrackets: {
          key: 'editor_code_auto_close_brackets',
          type: 'switch',
          title: { i18nKey: 'settings.editor.code_editing.auto_close.label' },
          desc: { i18nKey: 'settings.editor.code_editing.auto_close.desc' },
        },
        whitespace: {
          key: 'editor_code_whitespace',
          type: 'select',
          defaultValue: 'off',
          title: { i18nKey: 'settings.editor.code_editing.whitespace.label' },
          desc: { i18nKey: 'settings.editor.code_editing.whitespace.desc' },
          options: ['off', 'trailing', 'all'].map((value) => ({
            value,
            title: translate(value === 'off'
              ? 'settings.editor.code_editing.off'
              : `settings.editor.code_editing.whitespace.${value}`),
          })),
        },
      },
      Wysiwyg: {
        i18nKey: 'settings.editor.wysiwyg.label',
        livePreviewBlockBehavior: {
          key: 'wysiwyg_editor_live_preview_block_behavior',
          type: 'select',
          title: {
            i18nKey: 'settings.editor.wysiwyg.live_preview_block_behavior.label',
          },
          desc: {
            i18nKey: 'settings.editor.wysiwyg.live_preview_block_behavior.desc',
          },
          options: [
            {
              value: 'auto',
              title: translate('settings.editor.wysiwyg.live_preview_block_behavior.options.auto'),
            },
            {
              value: 'always-split',
              title: translate(
                'settings.editor.wysiwyg.live_preview_block_behavior.options.always_split',
              ),
            },
          ],
        },
        spellcheck: {
          key: 'wysiwyg_editor_spellcheck',
          type: 'switch',
          title: {
            i18nKey: 'settings.editor.wysiwyg.spellcheck.label',
          },
          desc: {
            i18nKey: 'settings.editor.wysiwyg.spellcheck.desc',
          },
        },
      },
      EmbeddedCode: {
        i18nKey: 'settings.editor.code_editing.embedded_label',
        ...getCodeDisplaySettings('embedded', translate, defaults.codeBlockLineWrapping === false),
        fontSize: {
          key: 'editor_code_font_size',
          type: 'slider',
          title: { i18nKey: 'settings.editor.code_editing.font_size.label' },
          desc: { i18nKey: 'settings.editor.code_editing.font_size.desc' },
          optionalValue: {
            initial: codeFontSize && Number.isFinite(codeFontSize)
              ? Math.min(40, Math.max(12, Math.round(codeFontSize)))
              : 14,
            defaultLabel: codeFontSizeLabel,
            note: typographyNote,
          },
          valueLabelI18nKey: 'settings.editor.code_editing.font_size.unit',
          scope: [12, 40],
        } satisfies Setting.SliderSettingItem,
        lineHeight: {
          key: 'editor_code_line_height',
          type: 'slider',
          title: { i18nKey: 'settings.editor.code_editing.line_height.label' },
          desc: { i18nKey: 'settings.editor.code_editing.line_height.desc' },
          optionalValue: {
            initial: 1.6,
            defaultLabel: translate('settings.editor.code_editing.line_height.default'),
            note: typographyNote,
          },
          valueLabelI18nKey: 'settings.editor.code_editing.line_height.unit',
          step: 0.1,
          saveToString: true,
          scope: [1, 2],
        } satisfies Setting.SliderSettingItem,
      },
      SourceCode: {
        i18nKey: 'settings.editor.sourcecode.label',
        ...getCodeDisplaySettings('source', translate),
        sourceFontSize: {
          key: 'editor_source_font_size',
          type: 'slider',
          title: { i18nKey: 'settings.editor.style.source_font_size.label' },
          desc: { i18nKey: 'settings.editor.style.source_font_size.desc' },
          scope: [12, 40],
        },
        sourceLineHeight: {
          key: 'editor_source_line_height',
          type: 'slider',
          title: { i18nKey: 'settings.editor.style.source_line_height.label' },
          desc: { i18nKey: 'settings.editor.style.source_line_height.desc' },
          step: 0.1,
          saveToString: true,
          scope: [1, 2],
        },
        spellcheck: {
          key: 'source_code_editor_spellcheck',
          type: 'switch',
          title: {
            i18nKey: 'settings.editor.sourcecode.spellcheck.label',
          },
          desc: {
            i18nKey: 'settings.editor.sourcecode.spellcheck.desc',
          },
        },
      },
    },
    image: {
      i18nKey: 'settings.image.label',
      iconName: 'ri-image-2-line',
      desc: {
        i18nKey: 'settings.image.desc',
      },
    },
    export: {
      i18nKey: 'settings.export.label',
      iconName: 'ri-file-transfer-line',
      desc: {
        i18nKey: 'settings.export.desc',
      },
    },
    copilot: {
      i18nKey: 'settings.copilot.label',
      iconName: 'ri-magic-line',
      desc: {
        i18nKey: 'settings.copilot.desc',
      },
      enable: {
        key: 'copilot_enabled',
        type: 'switch',
        title: {
          i18nKey: 'settings.copilot.enable.label',
        },
        desc: {
          i18nKey: 'settings.copilot.enable.desc',
        },
      },
      provider: {
        key: 'copilot_provider',
        type: 'select',
        title: {
          i18nKey: 'settings.copilot.provider.label',
        },
        desc: {
          i18nKey: 'settings.copilot.provider.desc',
        },
        options: [
          { value: 'ChatGPT', title: 'ChatGPT' },
          { value: 'DeepSeek', title: 'DeepSeek' },
          { value: 'Ollama', title: 'Ollama' },
          { value: 'Google', title: 'Google' },
        ],
      },
      model: {
        key: 'copilot_model',
        type: 'select',
        title: {
          i18nKey: 'settings.copilot.model.label',
        },
        desc: {
          i18nKey: 'settings.copilot.model.desc',
        },
      },
    },
    ai: {
      i18nKey: 'settings.ai.label',
      iconName: 'ri-sparkling-line',
      desc: {
        i18nKey: 'settings.ai.desc',
      },
      model: {
        i18nKey: 'settings.ai.model.label',
        children: [
          {
            providerId: 'openai' as const,
            i18nKey: 'settings.ai.ChatGPT.label',
            ApiBase: {
              key: 'extensions_chatgpt_apibase',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.ChatGPT.api_base.label',
              },
              desc: {
                i18nKey: 'settings.ai.ChatGPT.api_base.desc',
              },
            },
            ApiKey: {
              key: 'extensions_chatgpt_apikey',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.ChatGPT.api_key.label',
              },
              desc: {
                i18nKey: 'settings.ai.ChatGPT.api_key.desc',
              },
            },
            models: {
              key: 'extensions_chatgpt_models',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.ChatGPT.models.label',
              },
              desc: {
                i18nKey: 'settings.ai.ChatGPT.models.desc',
              },
            },
            requestHeaders: {
              key: 'extensions_chatgpt_request_headers',
              type: 'stringMapJson',
              title: {
                i18nKey: 'request.headers_config.label',
              },
              desc: {
                i18nKey: 'request.headers_config.desc',
              },
              i18nProps: {
                add: 'common.addHeader',
              },
            },
          },
          {
            providerId: 'deepseek' as const,
            i18nKey: 'settings.ai.DeepSeek.label',
            ApiBase: {
              key: 'extensions_deepseek_apibase',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.DeepSeek.api_base.label',
              },
              desc: {
                i18nKey: 'settings.ai.DeepSeek.api_base.desc',
              },
            },
            ApiKey: {
              key: 'extensions_deepseek_apikey',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.DeepSeek.api_key.label',
              },
              desc: {
                i18nKey: 'settings.ai.DeepSeek.api_key.desc',
              },
            },
            models: {
              key: 'extensions_deepseek_models',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.DeepSeek.models.label',
              },
              desc: {
                i18nKey: 'settings.ai.DeepSeek.models.desc',
              },
            },
            requestHeaders: {
              key: 'extensions_deepseek_request_headers',
              type: 'stringMapJson',
              title: {
                i18nKey: 'request.headers_config.label',
              },
              desc: {
                i18nKey: 'request.headers_config.desc',
              },
              i18nProps: {
                add: 'common.addHeader',
              },
            },
          },
          {
            providerId: 'ollama' as const,
            i18nKey: 'settings.ai.Ollama.label',
            ApiBase: {
              key: 'extensions_ollama_apibase',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.Ollama.api_base.label',
              },
              desc: {
                i18nKey: 'settings.ai.Ollama.api_base.desc',
              },
            },
            models: {
              key: 'extensions_ollama_models',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.Ollama.models.label',
              },
              desc: {
                i18nKey: 'settings.ai.Ollama.models.desc',
              },
            },
            requestHeaders: {
              key: 'extensions_ollama_request_headers',
              type: 'stringMapJson',
              title: {
                i18nKey: 'request.headers_config.label',
              },
              desc: {
                i18nKey: 'request.headers_config.desc',
              },
              i18nProps: {
                add: 'common.addHeader',
              },
            },
          },
          {
            providerId: 'google' as const,
            i18nKey: 'settings.ai.Google.label',
            ApiBase: {
              key: 'extensions_google_apibase',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.Google.api_base.label',
              },
              desc: {
                i18nKey: 'settings.ai.Google.api_base.desc',
              },
            },
            ApiKey: {
              key: 'extensions_google_apikey',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.Google.api_key.label',
              },
              desc: {
                i18nKey: 'settings.ai.Google.api_key.desc',
              },
            },
            models: {
              key: 'extensions_google_models',
              type: 'input',
              title: {
                i18nKey: 'settings.ai.Google.models.label',
              },
              desc: {
                i18nKey: 'settings.ai.Google.models.desc',
              },
            },
            requestHeaders: {
              key: 'extensions_google_request_headers',
              type: 'stringMapJson',
              title: {
                i18nKey: 'request.headers_config.label',
              },
              desc: {
                i18nKey: 'request.headers_config.desc',
              },
              i18nProps: {
                add: 'common.addHeader',
              },
            },
          },
        ],
      },
    },

    history: {
      i18nKey: 'history.title',
      iconName: 'ri-history-line',
      desc: { i18nKey: 'history.description' },
      Protection: {
        i18nKey: 'history.title',
        enabled: {
          key: 'local_history_enabled',
          type: 'switch',
          title: { i18nKey: 'history.enabled' },
          desc: { i18nKey: 'history.enabled_description' },
        },
      },
    },
    keyboard: {
      i18nKey: 'settings.keyboard.label',
      iconName: 'ri-keyboard-fill',
      desc: {
        i18nKey: 'settings.keyboard.desc',
      },
    },
    support: {
      i18nKey: 'settings.support.label',
      iconName: 'ri-heart-fill',
      desc: {
        i18nKey: 'settings.support.desc',
      },
    },
  }
}

export type SettingData = ReturnType<typeof getSettingMap>
