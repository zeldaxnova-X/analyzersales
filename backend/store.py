# In-memory store for dataframes
import uuid

# Dictionary to hold session_id -> pandas DataFrame
data_store = {}

def get_session_id():
    return str(uuid.uuid4())
