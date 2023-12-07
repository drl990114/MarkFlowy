import React from 'react'

interface SpaceProps extends BaseComponentProps {
  size?: number
}

const Space: React.FC<SpaceProps> = ({ children, size = 6, ...rest }) => {
  const normalStyle = {
    display: 'inline-block',
    marginLeft: `${size}px`,
  }

  const lastChildStyle = {
    display: 'inline-block',
    marginLeft: `${size}px`,
  }

  return (
    <span {...rest}>
      {React.Children.map(children, (child, index) => (
        <span key={index} style={index === children.length && index !== 0 ? lastChildStyle : normalStyle}>
          {child}
        </span>
      ))}
    </span>
  )
}

export default Space
