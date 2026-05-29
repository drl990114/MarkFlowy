import React from 'react';

import clsx from 'clsx';

import type { DialogProps as AkDialogProps } from '@ariakit/react';
import { Dialog as AkDialog, DialogDismiss } from '@ariakit/react';

import { DialogBackdrop, DialogWrapper } from './styles';

import Space from '../Space';

export interface DialogProps extends AkDialogProps {
  title?: string;
  hideDismiss?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  containerClass?: string;
  width?: string;
}

const Dialog = (props: DialogProps) => {
  const { title, footer, containerClass, children, width, hideDismiss = false, ...rest } = props;

  return (
    <AkDialog
      render={(dialogProps) => (
        <DialogBackdrop hidden={!rest.open}>
          <DialogWrapper {...dialogProps} width={width} />
        </DialogBackdrop>
      )}
      {...rest}
      backdrop={false}
    >
      {title ? (
        <div className="mf-dialog__heading">
          <div className="mf-dialog__heading__title">{title}</div>
          {hideDismiss ? null : <DialogDismiss className="mf-dialog__dismiss" />}
        </div>
      ) : hideDismiss ? null : (
        <DialogDismiss className="mf-dialog__dismiss" />
      )}
      <div className={clsx('mf-dialog__main', containerClass)}>{children}</div>
      {footer ? <Space className="mf-dialog__footer">{footer}</Space> : null}
    </AkDialog>
  );
};

export default Dialog;
