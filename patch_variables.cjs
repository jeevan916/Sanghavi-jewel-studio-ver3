const fs = require('fs');
const content = fs.readFileSync('src/components/admin/WhatsAppManagementPanel.tsx', 'utf8');

const replacement = `                    <p className="text-stone-600 text-[11px] leading-relaxed whitespace-pre-line font-sans italic">
                      {tpl.body_text}
                    </p>
                    
                    {tpl.sample_variables && tpl.sample_variables.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-1.5">
                        <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Sample Variables</span>
                        <div className="flex flex-wrap gap-1.5">
                          {tpl.sample_variables.map((v: any, vIdx: number) => (
                            <span key={vIdx} className="px-2 py-0.5 bg-stone-100 border border-stone-200 rounded text-[9px] font-mono text-stone-500">
                              {{\`\${vIdx+1}\`}}: {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}`;

const newContent = content.replace(
    /<p className="text-stone-600 text-\[11px\] leading-relaxed whitespace-pre-line font-sans italic">\s*\{tpl\.body_text\}\s*<\/p>/,
    replacement
);

fs.writeFileSync('src/components/admin/WhatsAppManagementPanel.tsx', newContent);
console.log('Patched panel variables');
