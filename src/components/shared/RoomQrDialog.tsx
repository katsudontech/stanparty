'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface RoomQrDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoomQrDialog({ isOpen, onClose }: RoomQrDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [roomUrl, setRoomUrl] = useState('');
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      setRoomUrl(window.location.href);
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="room-qr-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="room-qr-dialog__panel paper-card" onClick={(event) => event.stopPropagation()}>
        <header className="room-qr-dialog__header">
          <div>
            <p className="section-kicker">Invite by QR</p>
            <h2 id={titleId}>QRコードで招待</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="room-qr-dialog__close"
            aria-label="QRコード招待を閉じる"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="room-qr-dialog__body">
          <p id={descriptionId} className="room-qr-dialog__description">
            友達のスマホでこのQRコードを読み取ると、このルームに参加できます。
          </p>
          <div className="room-qr-dialog__code" aria-label="このルームの招待URLのQRコード">
            {roomUrl && (
              <QRCodeSVG
                value={roomUrl}
                size={240}
                level="H"
                includeMargin
                bgColor="#fffaf0"
                fgColor="#17231d"
              />
            )}
          </div>
          <button type="button" onClick={onClose} className="button-secondary w-full">
            閉じる
          </button>
        </div>
      </div>
    </dialog>
  );
}
