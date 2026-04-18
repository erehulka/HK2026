import receipt_processor

result = receipt_processor.process_receipt('test_data/complete_crumbled1.png', 'example_output.json')

if not result.ok:
    print(f"✗ Processing failed: {result.reason}")
    quit()

d = result.data
print("✓ Receipt processed successfully.")
print(f"  Languages    : {d.languages}  (override via result.data.items[n].language = 'xx')")
print(f"  OCR verified : {d.ocr_sum_verified}")
print(f"  JSON saved   : {result.json_path}")

print("\n── Items with detected languages:")
for i, item in enumerate(d.items):
    print(f"  [{i}] ({item.language}) {item.name!r}")

print("\n── Interpreting labels …")
interpreted = result.interpret_labels()
for ii in interpreted:
    flag = "" if ii.interpreted else "  ⚑ unrecognised"
    print(f"  [{ii.index}] ({ii.language}) {ii.original_name!r:30s} → {ii.interpreted_name!r}{flag}")

print("\n── Translating to English …")
translated = result.translate("English", interpreted=interpreted)
for ti in translated:
    print(f"  [{ti.index}] [{ti.source_language}] {ti.original_name!r:30s} → {ti.translated_name!r}")
