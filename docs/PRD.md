# Product Requirements: CropCare

## Problem

A farmer in Bihar who sees spots or blight on a tomato, potato or maize leaf often has no quick way to find out what it is. The nearest Krishi Vigyan Kendra (KVK) may be far away, mobile data is patchy in the field, and most plant-disease apps are in English.

## Target users

- Smallholder farmers in Bihar growing tomato, potato or maize
- Users who may have limited reading skills, so the app must work through large buttons, icons with labels and spoken Hindi
- Cheap Android phones (2 to 3 GB RAM), often with no internet in the field

## Goal

From one photo of a leaf, tell the farmer which of 14 known conditions it most likely shows, how sure the app is, and what to do about it, in Hindi and English, fully offline.

## Scope: the 14 classes

| Crop | Classes |
|---|---|
| Tomato | Bacterial spot, Early blight, Late blight, Leaf mold, Septoria leaf spot, Yellow leaf curl virus, Healthy |
| Potato | Early blight, Late blight, Healthy |
| Maize | Common rust, Northern leaf blight, Gray leaf spot, Healthy |

The canonical list and dataset name mapping live in `ml/class_map.json`.

## MVP

1. Home screen with large buttons and a Hindi/English switch
2. Camera screen with a guide box ("put one leaf inside the box")
3. Result screen: disease name in Hindi and English, confidence level, treatment steps, a button that reads them aloud, and "Was this correct? Yes / No"
4. Unsure screen when confidence is below the tuned threshold
5. History of past scans stored on the phone
6. Everything above works in airplane mode
7. Optional, consent-based upload of anonymous scan results when the phone is online

## Out of scope for version 1

- Rice and wheat (good public field datasets are small; planned for version 2)
- Detecting more than one disease on a leaf
- Pest identification, fertiliser advice, market prices
- Accounts, login, chat, payments
- iOS release

## Success criteria

Each item counts only with a real, measured number. No number is published before it is measured.

1. A results table for the baseline and final model on PlantVillage test, PlantDoc test and our own field photos
2. A chosen `.tflite` model that loses no more than about 1 to 2 accuracy points against the Keras model
3. The APK runs a scan end to end in airplane mode on a low-end Android phone
4. Treatment advice is checked by a named agriculture expert before the app is given to farmers
5. `/stats` shows real scans from pilot phones
