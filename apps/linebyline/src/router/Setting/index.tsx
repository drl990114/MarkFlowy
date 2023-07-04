import classNames from 'classnames'
import type { ReactNode } from 'react'
import { memo, useEffect, useState } from 'react'
import SettingGroup from '../../components/Setting/SettingGroup'
import { Container } from './styles'
import settingMap from '@/helper/cacheManager/settingMap'
import Logo from '@/assets/logo.svg'
import { invoke } from '@tauri-apps/api'

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

  return (
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
        <div className='conf-path'><small>Path: {confPath}</small></div>
        {curGroupKeys.map((key) => {
          return (
            <SettingGroup
              key={key}
              group={curGroup[key]}
              groupKey={key}
              categoryKey={curGroupKey}
            />
          )
        })}
      </div>
      {/* <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex', height: 224 }}>
      <Tabs orientation="vertical" variant="scrollable" value={value} onChange={handleChange} aria-label="Vertical tabs example" sx={{ borderRight: 1, borderColor: 'divider' }}>
        {settingDataGroups.map((group, index) => {
          return <Tab label="General" {...a11yProps(index)} />
        })}
      </Tabs>
      <TabPanel value={value} index={0}>
        {curGroupKeys.map((key) => {
          return <SettingGroup group={curGroup[key]} groupKey={key} categoryKey={curGroupKey} />
        })}
      </TabPanel>
    </Box> */}
    </Container>
  )
}

export default memo(Setting)
