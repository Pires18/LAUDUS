import { describe, it } from 'vitest';
import { deriveStructuredSchema } from '../modules/editor/structured/deriveSchema';
import unified from '../../scripts/laudia-deploy-unified.json';
const AREA = process.env.AUDIT_AREA || 'vascular';
describe('AUDIT', () => {
  it('dump', () => {
    for (const t of (unified as any[]).filter(x=>x.area===AREA)) {
      const s = deriveStructuredSchema(t as any, AREA);
      // eslint-disable-next-line no-console
      console.log('\n### '+t.name);
      for (const sec of s.sections) {
        const typed = sec.fields.some(f=>f.calcId||f.scoreKey||f.options||['triplet','calc','measure','select','multiselect'].includes(f.kind));
        console.log((typed?'  ✓ ':'  · ')+sec.label.slice(0,42).padEnd(43)+' → '+sec.fields.map(f=>f.id+(f.kind==='select'?'[sel]':f.kind==='measure'?'['+(f.unit||'n')+']':f.kind==='triplet'?'[3]':'')).join(', '));
      }
    }
  });
});
