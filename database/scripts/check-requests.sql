SELECT COUNT(*) as pending_count 
FROM product_update_requests 
WHERE request_status IN ('pending', 'approved', 'processing')
