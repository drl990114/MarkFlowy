# REST API health
GET http://127.0.0.1:8000/health

HTTP/1.1 200
[Asserts]
status == 200
jsonpath "$.data.status" == "running"

# GraphQL health
POST http://127.0.0.1:8000/graphql

```graphql
query {
	health {
		status
	}
}
```

HTTP/1.1 200
[Asserts]
status == 200
jsonpath "$.data.health.status" == "running"


# meta
POST http://127.0.0.1:8000/graphql

```graphql
query {
	meta {
		build
		version
	}
}
```

HTTP/1.1 200
[Asserts]
status == 200
jsonpath "$.data.meta.build" == "unknown"
