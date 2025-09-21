import { locales } from "@/i18n"

const SettingSchema = {
  general: {
    i18nKey: 'settings.general.label',
    iconName: 'ri-equalizer-line',
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
          value: key, title: locales[key as keyof typeof locales],
        })),
      },
    },
  },
  editor: {
    i18nKey: 'settings.editor.label',
    iconName: 'ri-edit-box-line',
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
  },
  image: {
    i18nKey: 'settings.image.label',
    iconName: 'ri-image-2-line',
  },
  ai: {
    i18nKey: 'settings.ai.label',
    iconName: 'ri-sparkling-line',
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
        },
      ],
    },
  },
  keyboard: {
    i18nKey: 'settings.keyboard.label',
    iconName: 'ri-keyboard-fill',
  },
}

export default SettingSchema

export type SettingData = typeof SettingSchema
