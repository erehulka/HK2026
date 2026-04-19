

import receipt_processor

result = receipt_processor.process_receipt('test_data/complete_crumbled1.png', 'outputs')

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

print("\n── Enhanced English labels …")
_interpreted, translated = receipt_processor.interpret_and_translate_labels(
    receipt_processor.snapshot_from_receipt_data(d),
)
for ti in translated:
    raw = d.items[ti.index].name
    print(f"  [{ti.index}] {raw!r:30s} → {ti.enhanced_name!r}")


print("------------- Testing sublist summarisation --------------")

cur_sublist = ['VINYL GLOVES']

print(f"Current sublist: {', '.join(cur_sublist)}")

print(receipt_processor.summarise_item_sublist(d, cur_sublist))
