import enum

from sqlalchemy import Enum as enum_type
class Priority_Level( str, enum.Enum):	
	overrider="overrider"
	high_priority="high_priority"
	medium_priority="medium_priority"
	low_priority="low_priority"
	expendable="expendable"

# ---------------------------------------------------------------------------
# Woodcraft vocabulary.
#
# Every one of these is a real database enum, not a String column. deals.stage
# was free text and the kanban board had to guess which values were legal; a
# typo like "dispatchd" was accepted silently and the row vanished from every
# board. Postgres rejects it instead.
#
# The VALUES must match frontend/src/lib/domain.js exactly - that file is the
# other half of this contract.
# ---------------------------------------------------------------------------


class Delivery_Status(str, enum.Enum):
	"""Where a piece is on its way to the customer. Ordered, so comparisons
	and progress bars follow the declaration order."""
	processing = "processing"
	dispatched = "dispatched"
	in_transit = "in_transit"
	delivered = "delivered"


class Order_Kind(str, enum.Enum):
	"""Deliveries and returns live in one table. A return is the same document
	inverted, so splitting them would let the Logistics board and the Orders
	ledger drift apart."""
	delivery = "delivery"
	returned = "return"


class Return_Type(str, enum.Enum):
	"""What the customer wants back. Drives the stock effect: refund and
	exchange put the item back, exchange_modified does not because the piece
	goes to the workshop instead of the shelf."""
	refund = "refund"
	exchange = "exchange"
	exchange_modified = "exchange_modified"


class Stock_Status(str, enum.Enum):
	"""Whether the order could be filled from stock. A shortfall is NOT a
	rejection - the order is accepted either way and the shortfall is a flag
	for the workshop."""
	fulfilled = "fulfilled"
	shortfall = "shortfall"


class Source(str, enum.Enum):
	"""Where the business came from. Carried across orders, leads, customers,
	carts and campaigns so channel performance is readable end to end."""
	website = "website"
	instagram = "instagram"
	facebook = "facebook"
	direct = "direct"


class Item_Class(str, enum.Enum):
	"""Inventory holds finished pieces and the raw material they are made
	from. They share every other field, so two tables would be duplication."""
	product = "product"
	material = "material"


class Unit(str, enum.Enum):
	"""Timber is bought by the board foot, finish by the litre, fittings by
	the pack. Without this, quantity is a number with no meaning."""
	piece = "piece"
	board_ft = "board_ft"
	litre = "litre"
	pack = "pack"


def pg_enum(py_enum, name):
	"""
	Build a database enum that stores VALUES, not Python attribute names.

	SQLAlchemy's default is to persist the attribute name. For every enum here
	except one that makes no difference, because name and value are identical.
	Order_Kind is the exception: "return" is a Python keyword, so the member
	has to be written `returned = "return"`. Left on the default, Postgres
	would hold "returned" while this codebase, the API contract and
	frontend/src/lib/domain.js all say "return" - a mismatch that would not
	show up until a row came back from the database and failed to match
	anything.

	Applied to all of them rather than just that one, so there is no rule to
	remember about which enums behave differently.
	"""
	return enum_type(py_enum, name=name, values_callable=lambda e: [m.value for m in e])
