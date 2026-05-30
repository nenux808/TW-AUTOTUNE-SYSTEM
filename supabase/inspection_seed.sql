-- TW AUTO TUNE Inspection Checklist Seed

insert into public.inspection_checklist_items
(category_id, item_name, input_type, measurement_unit, vehicle_type, sort_order)
select c.id, x.item_name, x.input_type, x.measurement_unit, x.vehicle_type, x.sort_order
from public.inspection_categories c
join (
  values
  ('Brakes', 'Front brake pads', 'status_measurement', 'mm', 'all', 1),
  ('Brakes', 'Rear brake pads / shoes', 'status_measurement', 'mm', 'all', 2),
  ('Brakes', 'Front rotors / discs', 'status', null, 'all', 3),
  ('Brakes', 'Rear rotors / drums', 'status', null, 'all', 4),
  ('Brakes', 'Brake fluid level', 'status', null, 'all', 5),
  ('Brakes', 'Brake fluid condition', 'status', null, 'all', 6),
  ('Brakes', 'Brake hoses / lines', 'status', null, 'all', 7),
  ('Brakes', 'Brake calipers', 'status', null, 'all', 8),
  ('Brakes', 'Handbrake / park brake', 'status', null, 'all', 9),
  ('Brakes', 'ABS warning light', 'status', null, 'all', 10),
  ('Brakes', 'Brake pedal feel', 'status', null, 'all', 11),
  ('Brakes', 'Brake road test', 'status', null, 'all', 12),

  ('Tyres & Wheels', 'Front left tyre tread', 'status_measurement', 'mm', 'all', 1),
  ('Tyres & Wheels', 'Front right tyre tread', 'status_measurement', 'mm', 'all', 2),
  ('Tyres & Wheels', 'Rear left tyre tread', 'status_measurement', 'mm', 'all', 3),
  ('Tyres & Wheels', 'Rear right tyre tread', 'status_measurement', 'mm', 'all', 4),
  ('Tyres & Wheels', 'Spare tyre', 'status', null, 'all', 5),
  ('Tyres & Wheels', 'Tyre pressure', 'status_measurement', 'PSI', 'all', 6),
  ('Tyres & Wheels', 'Tyre wear pattern', 'status', null, 'all', 7),
  ('Tyres & Wheels', 'Wheel nuts checked', 'status', null, 'all', 8),
  ('Tyres & Wheels', 'Wheel damage', 'status', null, 'all', 9),
  ('Tyres & Wheels', 'Tyre rotation required', 'status', null, 'all', 10),

  ('Steering & Suspension', 'Steering rack', 'status', null, 'all', 1),
  ('Steering & Suspension', 'Tie rod ends', 'status', null, 'all', 2),
  ('Steering & Suspension', 'Ball joints', 'status', null, 'all', 3),
  ('Steering & Suspension', 'Control arms', 'status', null, 'all', 4),
  ('Steering & Suspension', 'Suspension bushes', 'status', null, 'all', 5),
  ('Steering & Suspension', 'Shock absorbers / struts', 'status', null, 'all', 6),
  ('Steering & Suspension', 'Springs', 'status', null, 'all', 7),
  ('Steering & Suspension', 'Wheel bearings', 'status', null, 'all', 8),
  ('Steering & Suspension', 'Power steering operation', 'status', null, 'all', 9),
  ('Steering & Suspension', 'Suspension noise', 'status', null, 'all', 10),

  ('Engine Bay', 'Engine oil leaks', 'status', null, 'all', 1),
  ('Engine Bay', 'Coolant leaks', 'status', null, 'all', 2),
  ('Engine Bay', 'Drive belts', 'status', null, 'all', 3),
  ('Engine Bay', 'Air filter', 'status', null, 'all', 4),
  ('Engine Bay', 'Cabin filter', 'status', null, 'all', 5),
  ('Engine Bay', 'Spark plugs', 'status', null, 'petrol', 6),
  ('Engine Bay', 'Engine mounts', 'status', null, 'all', 7),
  ('Engine Bay', 'Radiator condition', 'status', null, 'all', 8),
  ('Engine Bay', 'Cooling fans', 'status', null, 'all', 9),
  ('Engine Bay', 'Hoses condition', 'status', null, 'all', 10),

  ('Fluids', 'Engine oil', 'status', null, 'all', 1),
  ('Fluids', 'Coolant', 'status', null, 'all', 2),
  ('Fluids', 'Brake fluid', 'status', null, 'all', 3),
  ('Fluids', 'Power steering fluid', 'status', null, 'all', 4),
  ('Fluids', 'Transmission fluid', 'status', null, 'all', 5),
  ('Fluids', 'Differential oil', 'status', null, '4x4', 6),
  ('Fluids', 'Transfer case oil', 'status', null, '4x4', 7),
  ('Fluids', 'Washer fluid', 'status', null, 'all', 8),

  ('Battery & Charging', 'Battery voltage', 'status_measurement', 'V', 'all', 1),
  ('Battery & Charging', 'Battery health', 'status', null, 'all', 2),
  ('Battery & Charging', 'Battery terminals', 'status', null, 'all', 3),
  ('Battery & Charging', 'Alternator charging', 'status_measurement', 'V', 'all', 4),
  ('Battery & Charging', 'Starter operation', 'status', null, 'all', 5),
  ('Battery & Charging', 'Battery clamp/security', 'status', null, 'all', 6),

  ('Lights & Electrical', 'Low beam headlights', 'status', null, 'all', 1),
  ('Lights & Electrical', 'High beam headlights', 'status', null, 'all', 2),
  ('Lights & Electrical', 'Park lights', 'status', null, 'all', 3),
  ('Lights & Electrical', 'Brake lights', 'status', null, 'all', 4),
  ('Lights & Electrical', 'Reverse lights', 'status', null, 'all', 5),
  ('Lights & Electrical', 'Indicators / hazards', 'status', null, 'all', 6),
  ('Lights & Electrical', 'Number plate lights', 'status', null, 'all', 7),
  ('Lights & Electrical', 'Horn', 'status', null, 'all', 8),
  ('Lights & Electrical', 'Dashboard warning lights', 'status', null, 'all', 9),

  ('Wipers & Windscreen', 'Front wiper blades', 'status', null, 'all', 1),
  ('Wipers & Windscreen', 'Rear wiper blade', 'status', null, 'all', 2),
  ('Wipers & Windscreen', 'Washer jets', 'status', null, 'all', 3),
  ('Wipers & Windscreen', 'Windscreen condition', 'status', null, 'all', 4),
  ('Wipers & Windscreen', 'Mirrors', 'status', null, 'all', 5),
  ('Wipers & Windscreen', 'Seat belts', 'status', null, 'all', 6),

  ('Exhaust', 'Exhaust leaks', 'status', null, 'all', 1),
  ('Exhaust', 'Exhaust mounts', 'status', null, 'all', 2),
  ('Exhaust', 'Muffler condition', 'status', null, 'all', 3),
  ('Exhaust', 'Excessive smoke', 'status', null, 'all', 4),
  ('Exhaust', 'Excessive noise', 'status', null, 'all', 5),

  ('Transmission / Drivetrain', 'Gear shifting', 'status', null, 'all', 1),
  ('Transmission / Drivetrain', 'Clutch operation', 'status', null, 'manual', 2),
  ('Transmission / Drivetrain', 'Transmission leaks', 'status', null, 'all', 3),
  ('Transmission / Drivetrain', 'CV joints / boots', 'status', null, 'all', 4),
  ('Transmission / Drivetrain', 'Driveshaft', 'status', null, 'all', 5),
  ('Transmission / Drivetrain', 'Differential leaks / noise', 'status', null, 'all', 6),

  ('4X4 System', 'Transfer case', 'status', null, '4x4', 1),
  ('4X4 System', 'Front differential', 'status', null, '4x4', 2),
  ('4X4 System', 'Rear differential', 'status', null, '4x4', 3),
  ('4X4 System', '4X4 engagement', 'status', null, '4x4', 4),
  ('4X4 System', 'Grease points lubricated', 'status', null, '4x4', 5),
  ('4X4 System', 'Underbody damage', 'status', null, '4x4', 6),
  ('4X4 System', 'Off-road components', 'status', null, '4x4', 7)
) as x(category_name, item_name, input_type, measurement_unit, vehicle_type, sort_order)
on c.name = x.category_name
where not exists (
  select 1
  from public.inspection_checklist_items existing
  where existing.category_id = c.id
  and existing.item_name = x.item_name
);
