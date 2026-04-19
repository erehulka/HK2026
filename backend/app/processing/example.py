

import receipt_processor

result = receipt_processor.process_receipt('test_data/incomplete3.jpg', 'outputs')

if not result.ok:
    print(f"✗ Processing failed: {result.reason}")
    quit()

d = result.data
print("✓ Receipt processed successfully.")
print(f"  Receipt tag: '{d.summary_label}'")
print(f"  Languages    : {d.languages}  (override via result.data.items[n].language = 'xx')")
print(f"  OCR verified : {d.ocr_sum_verified}")
print(f"  JSON saved   : {result.json_path}")

print("\n── Items with detected languages:")
for i, item in enumerate(d.items):
    print(f"  [{i}] ({item.language}) {item.name!r} ({item.unit_price}) x {item.quantity} ---> {item.total_price}")

"""print("\n── Interpreting labels …")
interpreted = result.interpret_labels()
for ii in interpreted:
    flag = "" if ii.interpreted else "  ⚑ unrecognised"
    print(f"  [{ii.index}] ({ii.language}) {ii.original_name!r:30s} → {ii.interpreted_name!r}{flag}")"""

print("\n── Translating to English …")
translated = result.translate("Slovak")
for ti in translated:
    print(f"  [{ti.index}] [{ti.source_language}] {ti.original_name!r:30s} → {ti.translated_name!r}")


print("------------- Testing sublist summarisation --------------")

cur_sublist = ['BELL PEP RED', 'PEP GREEN BELL', 'BONELESS CHICKEN']

print(f"Current sublist: {', '.join(cur_sublist)}")

print(receipt_processor.summarise_item_sublist(d, cur_sublist))
