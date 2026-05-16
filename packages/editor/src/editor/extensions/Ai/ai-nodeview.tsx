import type { NodeViewComponentProps } from '@rme-sdk/react'
import { t } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Button, Menu } from 'zens'
import { getTransformerByView } from '../Transformer/utils'
import { AIOptions } from './ai-types'

enum AINodeViewStatus {
  WAITASK,
  LOADING,
  SUCCESS,
  ERROR,
}

interface AINodeViewProps extends NodeViewComponentProps, AIOptions {}

export function AINodeView(props: AINodeViewProps) {
  const { supportProviderInfosMap, generateText, getPosition, defaultSelectProvider } = props
  const pos = getPosition()

  const [status, setStatus] = useState(AINodeViewStatus.WAITASK)

  const providers = Object.keys(supportProviderInfosMap)
  const [selectedProvider, setSelectedProvider] = useState(defaultSelectProvider || providers[0])

  const providerInfo = supportProviderInfosMap[selectedProvider]
  const [selectedModel, setSelectedModel] = useState(providerInfo.models[0])

  const [generatedText, setGeneratedText] = useState('')
  const [prompt, setPrompt] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const transformer = getTransformerByView(props.view)

  const generateTextHandler = async () => {
    setStatus(AINodeViewStatus.LOADING)
    try {
      if (controllerRef.current) {
        controllerRef.current.abort()
      }
      controllerRef.current = new AbortController()

      const text = await generateText({
        provider: selectedProvider,
        model: selectedModel,
        prompt: prompt,
      })

      if (controllerRef.current?.signal.aborted) {
        return
      }

      if (text) {
        setGeneratedText(text)
        setStatus(AINodeViewStatus.SUCCESS)
      } else {
        setStatus(AINodeViewStatus.ERROR)
      }
    } catch (error) {
      setStatus(AINodeViewStatus.ERROR)
    }
  }
  const renderActionButton = () => {
    switch (status) {
      case AINodeViewStatus.WAITASK:
        return (
          <Button size="small" btnType="primary" onClick={generateTextHandler}>
            <i className="ri-bard-line"></i>
            {t('ai.generate')}
          </Button>
        )
      case AINodeViewStatus.LOADING:
        return [
          <Button size="small" disabled key="loading">
            {t('common.loading')}...
          </Button>,
          <Button
            size="small"
            key="stop"
            onClick={() => {
              controllerRef.current?.abort()
              setStatus(AINodeViewStatus.WAITASK)
            }}
          >
            <i className="ri-stop-line"></i>
            {t('ai.stop')}
          </Button>,
        ]
      case AINodeViewStatus.SUCCESS:
        return [
          <Button
            size="small"
            btnType="primary"
            key="accept"
            onClick={() => {
              if (generatedText) {
                try {
                  const doc = transformer.stringToDoc?.(generatedText)
                  if (doc && pos !== undefined) {
                    const transaction = props.view.state.tr.replaceWith(pos, pos + 1, doc)
                    props.view.dispatch(transaction)
                  }
                } catch (error) {
                  console.log('ai-node error', error)
                }
              }
            }}
          >
            {t('common.accept')}
          </Button>,
          <Button size="small" key="regenerate" onClick={generateTextHandler}>
            {t('ai.regenerate')}
          </Button>,
        ]
      case AINodeViewStatus.ERROR:
        return (
          <Button size="small" btnType="primary" onClick={generateTextHandler}>
            {t('ai.retry')}
          </Button>
        )
    }
  }

  const renderPreview = () => {
    if (status === AINodeViewStatus.WAITASK) {
      return null
    } else if (status === AINodeViewStatus.LOADING) {
      return <StatusTitle key={AINodeViewStatus.LOADING}>{t('common.loading')}...</StatusTitle>
    } else if (status === AINodeViewStatus.SUCCESS) {
      return (
        <div>
          <StatusTitle key={AINodeViewStatus.SUCCESS}>{t('ai.preview')}</StatusTitle>
          <blockquote>{generatedText}</blockquote>
        </div>
      )
    } else if (status === AINodeViewStatus.ERROR) {
      return <ErrorStatueTitle>{t('ai.error')}</ErrorStatueTitle>
    }
  }

  return (
    <Container>
      <div>
        {renderPreview()}
        <StatusTitle>{t('ai.prompt')}</StatusTitle>
        <InputAskTextarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>
      <div className="divider"></div>
      <BottomBar>
        <AIInfo>
          <Menu
            menuButtonProps={{
              size: 'small',
              style: {
                marginRight: '8px',
              },
            }}
            items={providers.map((provider) => ({
              label: provider,
              value: provider,
              handler: () => {
                setSelectedProvider(provider)
                setSelectedModel(supportProviderInfosMap[provider]?.models[0])
              },
            }))}
          >
            {selectedProvider || 'Select Provider'}
          </Menu>
          <Menu
            menuButtonProps={{
              size: 'small',
            }}
            items={providerInfo.models.map((model) => ({
              label: model,
              value: model,
              handler: () => {
                setSelectedModel(model)
              },
            }))}
          >
            {selectedModel || 'Select Model'}
          </Menu>
        </AIInfo>
        <ActionButtonGroup>{renderActionButton()}</ActionButtonGroup>
      </BottomBar>
    </Container>
  )
}

const Container = styled.div`
  padding: 16px;
  border: 1px solid ${(props) => props.theme.borderColor};
  user-select: none;
  -webkit-user-select: none;
  border-radius: ${(props) => props.theme.smallBorderRadius};

  & .divider {
    margin: 8px 0;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
  }
`

const AIInfo = styled.div`
  display: flex;
  margin-bottom: 8px;
  font-size: 12px;
  margin-right: 8px;
  user-select: none;
  -webkit-user-select: none;
`

const InputAskTextarea = styled.textarea`
  width: -webkit-fill-available;
  min-height: 80px;
  max-height: 200px;
  padding: 8px;
  border-radius: 4px;
  resize: none;
  border: 1px solid ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.borderColor};
  color: inherit;

  &:focus {
    background-color: transparent;
  }
`

const StatusTitle = styled.div`
  margin-right: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: bold;
  user-select: none;
  -webkit-user-select: none;
`

const ErrorStatueTitle = styled.div`
  margin-right: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: bold;
  color: ${(props) => props.theme.warnColor};
  user-select: none;
  -webkit-user-select: none;
`

const BottomBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const ActionButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`
