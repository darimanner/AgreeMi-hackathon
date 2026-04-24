// pages/UploadPage.tsx
// Thin page wrapper — owns nothing, delegates all logic to the feature slice
import React from 'react';
import { UploadFeature } from '../features/upload/UploadFeature';

const UploadPage: React.FC = () => <UploadFeature />;

export default UploadPage;
