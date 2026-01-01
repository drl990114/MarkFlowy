import { changeLng, Langs, locales } from '@/i18n'
import { currentWebview } from '@/services/windows'
import i18n from 'i18next'
import { EditorViewType } from 'rme'

export const getSettingMap = () => {
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
      },
    },
    display: {
      i18nKey: 'settings.display.label',
      iconName: 'ri-window-line',
      desc: {
        i18nKey: 'settings.display.desc',
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
            { value: EditorViewType.WYSIWYG, title: i18n.t('view.wysiwyg') },
            { value: EditorViewType.SOURCECODE, title: i18n.t('view.source_code') },
          ],
        },
      },
      Wysiwyg: {
        i18nKey: 'settings.editor.wysiwyg.label',
        mdDefaultMode: {
          key: 'wysiwyg_editor_codemirror_line_wrap',
          type: 'switch',
          title: {
            i18nKey: 'settings.editor.wysiwyg.codemirror_linewrap.label',
          },
          desc: {
            i18nKey: 'settings.editor.wysiwyg.codemirror_linewrap.desc',
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
    keyboard: {
      i18nKey: 'settings.keyboard.label',
      iconName: 'ri-keyboard-fill',
      desc: {
        i18nKey: 'settings.keyboard.desc',
      },
    },
  }
}

export type SettingData = ReturnType<typeof getSettingMap>
