import { describe, expect, it } from 'vitest';
import { placeOf } from '../files';

describe('placeOf: where the app save dialog put a file', () => {
  it('reads an Android document address', () => {
    expect(placeOf('content://com.android.externalstorage.documents/document/primary%3ADocuments%2FCours%2Ftravail.docx', 'x.docx'))
      .toEqual({ name: 'travail.docx', where: 'Documents/Cours' });
  });
  it('the downloads provider gives a number: the name asked, in Downloads', () => {
    expect(placeOf('content://com.android.providers.downloads.documents/document/msf%3A1000012345', 'travail.docx'))
      .toEqual({ name: 'travail.docx', where: 'downloads' });
  });
  it('reads a desktop path', () => {
    expect(placeOf('C:\\Users\\Martin\\Documents\\travail.docx', 'x.docx')).toEqual({ name: 'travail.docx', where: 'C:\\Users\\Martin\\Documents' });
    expect(placeOf('/home/martin/travail.docx', 'x.docx')).toEqual({ name: 'travail.docx', where: '/home/martin' });
  });
});
