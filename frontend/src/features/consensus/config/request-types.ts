import { FormField } from './types';

export const REQUEST_TYPES = [
  {
    id: 'whitelist-onedrive-domain',
    label: 'Whitelist Onedrive Sharing Domain',
    fields: [
      {
        id: 'email',
        label: 'Example Email Address',
        type: 'email',
        placeholder: 'john@abc.com',
        validation: {
          required: true,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: 'Please enter a valid email address',
        },
      },
    ],
  },
  {
    id: 'whitelist-file-upload',
    label: 'Whitelist File Upload Website',
    fields: [
      {
        id: 'url',
        label: 'Domain / Website Url / Website Link',
        type: 'url',
        placeholder: 'https://www.abc.com',
        validation: {
          required: true,
          pattern: /^https:\/\/.+/,
          message: 'Please enter a valid HTTPS URL',
        },
      },
    ],
  },
  {
    id: 'access-archived-project',
    label: 'Access Archived Project Folder',
    fields: [
      {
        id: 'project',
        label: 'Archived Project',
        type: 'select',
        options: [
          { value: '1000', label: '1000 Project A' },
          { value: '2000', label: '2000 Project B' },
          { value: '3000', label: '3000 Project C' },
        ],
        validation: {
          required: true,
          message: 'Please select a project',
        },
      },
      {
        id: 'accessUntil',
        label: 'Access Until',
        type: 'date',
        validation: {
          required: true,
          future: true,
          maxYears: 1,
          message: 'Please select a date within the next year',
        },
      },
    ],
  },
] as const; 