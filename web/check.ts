import DOMPurify from 'isomorphic-dompurify';
import * as dp2 from 'isomorphic-dompurify';

console.log('Default import:', typeof DOMPurify, Object.keys(DOMPurify || {}));
console.log('Star import:', typeof dp2, Object.keys(dp2 || {}));

if (typeof DOMPurify === 'function') {
  console.log('Default is a function. Calling it:', Object.keys(DOMPurify()));
}
