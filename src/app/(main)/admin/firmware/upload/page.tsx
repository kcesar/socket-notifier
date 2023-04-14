'use client';

import { DragEvent, useState } from 'react';
import { useAppSelector } from '@/lib/client/store';

import styles from './page.module.css';

function AdminBody() {
  const [file, setFile] = useState<File>();
  const [ description, setDescription ] = useState<string>('');
  
  async function uploadFiles() {
    if (!file) return;

    const formData = new FormData();
    formData.append("description", description);
    formData.append("file", file);
    const response = await fetch('/api/firmware/upload', {
      method: 'POST',
      body: formData,
    });
    alert(`finished upload. success=${response.ok}`);
  }

  function stopEvent(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  const handleDragOver = (e: DragEvent) => {
    stopEvent(e);
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (e: DragEvent) => {
    stopEvent(e);
    let files = [...e.dataTransfer?.files];
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  return (<>
    <div
      className={styles.dropzone}
      onDragEnter={(e) => stopEvent(e)}
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={(e) => stopEvent(e)}
      onDrop={(e) => handleDrop(e)}
    >
      {/* <Image src="/upload.svg" alt="upload" height={50} width={50} /> */}

      <input
        id="fileSelect"
        type="file"
        multiple
        className={styles.files}
      />

      <h3 className={styles.uploadMessage}>
        drag &amp; drop your file here
      </h3>
    </div>
    {file ? <div>{file.name}</div> : <></>}
    <div>Description: <input type="text" value={description} onChange={evt => setDescription(evt.target.value)} /></div>
    <button disabled={!file} onClick={uploadFiles} className={styles.uploadBtn}>Upload</button>
  </>);
}

export default function FirmwareUploadPage() {
  const isAdmin = useAppSelector(state => state.auth.userInfo?.isAdmin);

  return (isAdmin ? <AdminBody /> : <div>Admins only</div>);
}