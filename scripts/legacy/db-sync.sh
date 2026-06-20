# Legacy migration note
#
# This script was intentionally disabled for the 10/10 laptop-only architecture.
# Current production data lives on local PostgreSQL at localhost:5432 and is managed
# with Prisma Migrate plus Admin → Data Management backups/restores.
#
# Do not use managed database migration scripts for production.
exit 1
