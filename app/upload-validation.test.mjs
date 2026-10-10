import test from 'node:test';
import assert from 'node:assert/strict';
import {detectAllowedFileType, safeAttachmentName, validObjectKey} from './upload-validation.mjs';
test('Detecta PNG pelo conteúdo, não pelo MIME declarado',()=>assert.equal(detectAllowedFileType(Uint8Array.from([137,80,78,71,13,10,26,10,0])),'image/png'));
test('Rejeita conteúdo de arquivo inválido',()=>assert.equal(detectAllowedFileType(new TextEncoder().encode('<script>evil</script>')),null));
test('Rejeita JPEG truncado',()=>assert.equal(detectAllowedFileType(Uint8Array.from([255,216,255,0])),null));
test('Detecta PDF com assinatura básica',()=>assert.equal(detectAllowedFileType(new TextEncoder().encode('%PDF-1.7\nbody')), 'application/pdf'));
test('Remove caminhos e quebras de linha do nome',()=>assert.equal(safeAttachmentName('C:\\fake\\comprovante\r\n.pdf'),'comprovante.pdf'));
test('Impede leitura com chave arbitrária',()=>{assert.equal(validObjectKey('../foo'),false);assert.equal(validObjectKey('00000000-0000-4000-8000-000000000000'),true);});
