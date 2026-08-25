import enum
class Priority_Level( str, enum.Enum):	
	overrider="overrider"
	high_priority="high_priority"
	medium_priority="medium_priority"
	low_priority="low_priority"
	expendable="expendable"