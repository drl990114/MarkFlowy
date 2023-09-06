import classNames from 'classnames'
import type { ReactNode } from 'react'
import { memo, useEffect, useState } from 'react'
import SettingGroup from './component/SettingGroup'
import { Container } from './styles'
import settingMap from '@/router/Setting/settingMap'
import Logo from '@/assets/logo.svg'
import { invoke } from '@tauri-apps/api'
import TitleBar from '@/components/TitleBar'
import { KeyboardTable } from './KeyboardTable'
import { CopyButton } from '@/components/UI/Button'

export interface DialogTitleProps {
  children?: ReactNode
  onClose: () => void
}

function a11yProps(index: number) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  }
}

function Setting() {
  const [value, setValue] = useState(0)
  const [confPath, setConfPath] = useState('')
  const settingDataGroups = Object.keys(settingMap)
  const curGroupKey = settingDataGroups[value] as keyof typeof settingMap
  const curGroup = settingMap[curGroupKey] as Setting.SettingData
  const curGroupKeys = Object.keys(curGroup)

  useEffect(() => {
    invoke('get_app_conf_path').then((res: unknown) => {
      setConfPath(res as string)
    })
  }, [])

  const renderCurrentSettingData = () => {
    if (curGroupKey === 'keyboard') {
      return <KeyboardTable />
    }

    return curGroupKeys.map((key) => {
      return (
        <SettingGroup
          key={key}
          group={curGroup[key]}
          groupKey={key}
          categoryKey={curGroupKey}
        />
      )
    })
  }

  return (
    <>
      <TitleBar transparent />
      <Container>
        <div id="sidebar">
          <div className="title">
            <Logo />
          </div>
          {/* TODO search */}
          {/* <div id="search-form" role="search">
          <input id="q" aria-label="Search contacts" placeholder="Search" type="search" name="q" />
        </div> */}
          <nav>
            <ul>
              {settingDataGroups.map((group, index) => {
                return (
                  <li
                    key={group}
                    className={classNames({
                      active: index === value,
                    })}
                    {...a11yProps(index)}
                    onClick={() => {
                      setValue(index)
                    }}
                  >
                    {group}
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
        <div id="detail">
          <div className="conf-path">
            <small>Path: {confPath}  <CopyButton text={confPath}/></small>
          </div>
          {renderCurrentSettingData()}
        </div>
      </Container>
    </>
  )
}

export default memo(Setting)
